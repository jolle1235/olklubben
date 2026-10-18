"use server";

import { notFound, redirect } from "next/navigation";

import {
  ACTION_ERROR_CODES,
  DEFAULT_ERROR_MESSAGES,
  fail,
  unexpectedError,
  validationError,
  type ActionError,
  type FieldErrors,
  type FormFailure,
} from "@/lib/action-result";
import { withToast, type FlashToastKey } from "@/lib/flash-toast";
import { readFormValues } from "@/lib/form-data";
import { pollHref } from "@/lib/routes";
import { idSchema } from "@/lib/validation/id";
import {
  BALLOT_ARRAY_FIELDS,
  ballotMessage,
  ballotSchema,
  NOTHING_TO_VOTE_MESSAGE,
  POLL_ARRAY_FIELDS,
  POLL_OPTIONS_LOCKED_MESSAGE,
  POLL_PLACE_ERROR_MESSAGES,
  pollEditSchema,
  pollFormSchema,
  pollRefSchema,
  pollTimingMessage,
} from "@/lib/validation/poll";
import { requireMembership } from "@/server/auth/session";
import type { BallotErrorCode } from "@/server/domain/polls/ballot";
import { canCreatePoll, canManagePoll, canVote } from "@/server/domain/polls/permissions";
import { requirePoll } from "@/server/polls/access";
import {
  castBallot,
  createPoll,
  PlaceNotSelectableError,
  updatePoll,
  type CastBallotResult,
} from "@/server/polls/mutations";
import { getPollView } from "@/server/polls/queries";
import { revalidateClub } from "@/server/revalidate";

/**
 * Server Actions for creating, editing and voting on polls (SPEC §9.7.1–
 * §9.7.3, §4.3, D-133–D-136). OWNER: P1 (round 4). The foundation froze the
 * signatures and types below; the bodies are P1's.
 *
 * Order in every action (§4.3, D-127): ids (pollRefSchema / idSchema → 404)
 * → Zod (src/lib/validation/poll.ts) → requirePoll / requireMembership
 * (membership + same club, E22) → can* (FORBIDDEN) → domain timing check →
 * data layer (src/server/polls/mutations.ts, re-checks under the lock) →
 * revalidateClub → redirect(withToast(…)).
 *
 * Form fields:
 *   createPollAction  clubId (hidden), title, theme, description, dates[],
 *                     startTime, placeIds[], newPlace, newPlaceName,
 *                     newPlaceAddress, newPlaceMine, deadlineDate, deadlineTime
 *   updatePollAction  clubId, pollId (hidden), title, theme, description,
 *                     deadlineDate, deadlineTime; while nobody has voted also
 *                     editOptions (hidden "1") and the create form's option
 *                     fields (D-153)
 *   castBallotAction  clubId, pollId (hidden), dateOptionIds[], noDateWorks,
 *                     placeOptionId
 */

/** The create form's text fields (echoed back after a failed submit). */
export type PollFormTextField =
  | "title"
  | "theme"
  | "description"
  | "startTime"
  | "newPlace"
  | "newPlaceName"
  | "newPlaceAddress"
  | "newPlaceMine"
  | "deadlineDate"
  | "deadlineTime";

export type PollFormValues = Partial<Record<PollFormTextField, string>> & {
  dates?: string[];
  placeIds?: string[];
};

/** The edit form's echo: the create form's fields (the options only with editOptions, D-153). */
export type PollEditFormValues = PollFormValues & { editOptions?: string };

export type BallotFormValues = {
  dateOptionIds?: string[];
  noDateWorks?: string;
  placeOptionId?: string;
};

/** useActionState state: null before the first submit. Success redirects. */
export type PollFormState = FormFailure<PollFormValues> | null;
export type PollEditFormState = FormFailure<PollEditFormValues> | null;
export type BallotFormState = FormFailure<BallotFormValues> | null;

// ── Shared ──────────────────────────────────────────────────────────────────

const POLL_TEXT_FIELDS = [
  "title",
  "theme",
  "description",
  "startTime",
  "newPlace",
  "newPlaceName",
  "newPlaceAddress",
  "newPlaceMine",
  "deadlineDate",
  "deadlineTime",
] as const satisfies readonly PollFormTextField[];

const POLL_EDIT_FIELDS = [
  ...POLL_TEXT_FIELDS,
  "editOptions",
] as const satisfies readonly (keyof PollEditFormValues)[];

const NOT_ALLOWED_TO_CREATE = "Kun medlemmer kan planlægge en ølsmagning.";
const NOT_ALLOWED_TO_EDIT = "Kun opretteren og klubbens admins kan rette afstemningen.";
const NOT_ALLOWED_TO_VOTE = "Kun medlemmer kan stemme.";

function failed<V>(result: { ok: false; error: ActionError }, values: V): FormFailure<V> {
  return { ...result, values };
}

function fieldFailure<V>(field: string, message: string, values: V): FormFailure<V> {
  return failed(
    fail(ACTION_ERROR_CODES.VALIDATION, DEFAULT_ERROR_MESSAGES.VALIDATION, { [field]: [message] }),
    values,
  );
}

/** The scalar fields of a submitted form (the first value of each; files ignored). */
function pickText<F extends string>(
  raw: Record<string, string | string[]>,
  fields: readonly F[],
): Partial<Record<F, string>> {
  const values: Partial<Record<F, string>> = {};
  for (const field of fields) {
    const value = raw[field];
    if (typeof value === "string") values[field] = value;
  }
  return values;
}

/** Polls of another club, malformed ids and unknown polls are all a 404 (E22). */
function parsePollRef(formData: FormData): { clubId: string; pollId: string } {
  const ids = pollRefSchema.safeParse({
    clubId: formData.get("clubId"),
    pollId: formData.get("pollId"),
  });
  if (!ids.success) notFound();
  return ids.data;
}

// ── Create ──────────────────────────────────────────────────────────────────

/**
 * The poll form's values (create, and edit with its editOptions). The
 * default list cap (50): the schema refuses more than 10 dates / places
 * itself, and blank no-JS date rows are dropped before that count.
 */
function readPollFormValues<F extends string>(
  formData: FormData,
  textFields: readonly F[],
): Partial<Record<F, string>> & Pick<PollFormValues, "dates" | "placeIds"> {
  const raw = readFormValues(formData, { arrays: POLL_ARRAY_FIELDS });
  const values: Partial<Record<F, string>> & Pick<PollFormValues, "dates" | "placeIds"> = pickText(
    raw,
    textFields,
  );
  if (Array.isArray(raw.dates)) values.dates = raw.dates;
  if (Array.isArray(raw.placeIds)) values.placeIds = raw.placeIds;
  return values;
}

/**
 * "Opret afstemning". created → pollHref + "poll-created"; not-member →
 * notFound(); timing → field error (pollTimingMessage); nothing-to-vote →
 * dates (NOTHING_TO_VOTE_MESSAGE); PlaceNotSelectableError → placeIds
 * (POLL_PLACE_ERROR_MESSAGES).
 *
 * The clock-dependent rules (dates and deadline in the future) are decided by
 * the data layer with the request's `now`, before anything is written and
 * again under its locks; the form's own schema is pure (C10).
 */
export async function createPollAction(
  _previous: PollFormState,
  formData: FormData,
): Promise<PollFormState> {
  const clubId = idSchema.safeParse(formData.get("clubId"));
  if (!clubId.success) notFound();

  const values: PollFormValues = readPollFormValues(formData, POLL_TEXT_FIELDS);
  const parsed = pollFormSchema.safeParse(values);
  if (!parsed.success) return failed(validationError(parsed.error), values);
  const data = parsed.data;

  const { user, membership, club } = await requireMembership(clubId.data);
  if (!canCreatePoll(membership)) {
    return failed(fail(ACTION_ERROR_CODES.FORBIDDEN, NOT_ALLOWED_TO_CREATE), values);
  }

  let pollId: string;
  try {
    const result = await createPoll({
      clubId: club.id,
      createdById: user.id,
      now: new Date(),
      ...data,
    });
    switch (result.status) {
      case "not-member":
        notFound();
      case "timing": {
        const { field, message } = pollTimingMessage(result.error, {
          firstDate: data.dateStartsAt[0] ?? null,
        });
        return fieldFailure(field, message, values);
      }
      case "nothing-to-vote":
        return fieldFailure("dates", NOTHING_TO_VOTE_MESSAGE, values);
      case "created":
        pollId = result.id;
        break;
    }
  } catch (error) {
    if (error instanceof PlaceNotSelectableError) {
      return fieldFailure("placeIds", POLL_PLACE_ERROR_MESSAGES[error.reason], values);
    }
    console.error("[polls] createPoll failed", error);
    return failed(unexpectedError(), values);
  }

  revalidateClub(club.id);
  redirect(withToast(pollHref(club.id, pollId), "poll-created"));
}

// ── Edit ────────────────────────────────────────────────────────────────────

/**
 * "Gem ændringer" (creator or admin while OPEN). updated → pollHref +
 * "poll-updated"; closed → pollHref + "poll-locked"; forbidden → FORBIDDEN
 * "Kun opretteren og klubbens admins kan rette afstemningen."; timing → the
 * field pollTimingMessage names; options-locked → CONFLICT
 * (POLL_OPTIONS_LOCKED_MESSAGE, values echoed, the page re-rendered without
 * the option fields); nothing-to-vote → dates; PlaceNotSelectableError →
 * placeIds.
 *
 * Fields: clubId, pollId (hidden), title, theme, description, deadlineDate,
 * deadlineTime – and, while nobody has voted, editOptions plus the create
 * form's option fields (D-153). With ballots the deadline only moves later and
 * must stay before the first date (E24); without, the new options follow
 * create's rules. updatePoll decides under the poll lock.
 */
export async function updatePollAction(
  _previous: PollEditFormState,
  formData: FormData,
): Promise<PollEditFormState> {
  const ids = parsePollRef(formData);
  const values: PollEditFormValues = readPollFormValues(formData, POLL_EDIT_FIELDS);
  const parsed = pollEditSchema.safeParse(values);
  if (!parsed.success) return failed(validationError(parsed.error), values);
  const data = parsed.data;

  const { user, membership, club, poll } = await requirePoll(ids.clubId, ids.pollId);
  if (!canManagePoll(membership, poll, user.id)) {
    return failed(fail(ACTION_ERROR_CODES.FORBIDDEN, NOT_ALLOWED_TO_EDIT), values);
  }

  let result: Awaited<ReturnType<typeof updatePoll>>;
  try {
    result = await updatePoll({
      clubId: club.id,
      pollId: poll.id,
      actorUserId: user.id,
      now: new Date(),
      ...data,
    });
  } catch (error) {
    if (error instanceof PlaceNotSelectableError) {
      return fieldFailure("placeIds", POLL_PLACE_ERROR_MESSAGES[error.reason], values);
    }
    console.error("[polls] updatePoll failed", error);
    return failed(unexpectedError(), values);
  }

  switch (result.status) {
    case "not-found":
      notFound();
    case "forbidden":
      return failed(fail(ACTION_ERROR_CODES.FORBIDDEN, NOT_ALLOWED_TO_EDIT), values);
    case "options-locked":
      // Re-render the page: it now shows the options read-only (ballotCount ≥ 1).
      revalidateClub(club.id);
      return failed(fail(ACTION_ERROR_CODES.CONFLICT, POLL_OPTIONS_LOCKED_MESSAGE), values);
    case "nothing-to-vote":
      return fieldFailure("dates", NOTHING_TO_VOTE_MESSAGE, values);
    case "timing": {
      // The first date names the message: the new one, else the stored one (one extra read).
      const firstDate = data.options
        ? (data.options.dateStartsAt[0] ?? null)
        : result.error === "DEADLINE_NOT_BEFORE_FIRST_DATE"
          ? ((await getPollView(club.id, poll.id, user.id))?.dates[0]?.startsAt ?? null)
          : null;
      const { field, message } = pollTimingMessage(result.error, {
        firstDate,
        previousDeadline: poll.deadline,
      });
      return fieldFailure(field, message, values);
    }
    case "closed":
      revalidateClub(club.id);
      redirect(withToast(pollHref(club.id, poll.id), "poll-locked"));
    case "updated":
      // The calendar's "Mulig dato" rows follow the options (D-137).
      revalidateClub(club.id);
      redirect(withToast(pollHref(club.id, poll.id), "poll-updated"));
  }
}

// ── Vote ────────────────────────────────────────────────────────────────────

function readBallotFormValues(formData: FormData): BallotFormValues {
  const raw = readFormValues(formData, { arrays: BALLOT_ARRAY_FIELDS });
  const values: BallotFormValues = pickText(raw, ["noDateWorks", "placeOptionId"] as const);
  if (Array.isArray(raw.dateOptionIds)) values.dateOptionIds = raw.dateOptionIds;
  return values;
}

/**
 * castBallot's domain errors as the form's next state. An option that is not
 * in the poll (a forged or stale form, F-038) is a form error ("Genindlæs
 * siden"), never a field error.
 */
function ballotFailure(
  errors: Partial<Record<"dateOptionIds" | "placeOptionId", BallotErrorCode>>,
  values: BallotFormValues,
): BallotFormState {
  const fieldErrors: FieldErrors = {};
  for (const code of Object.values(errors)) {
    if (!code) continue;
    const { field, message } = ballotMessage(code);
    if (field === null) return failed(fail(ACTION_ERROR_CODES.CONFLICT, message), values);
    fieldErrors[field] = [message];
  }
  return failed(
    fail(ACTION_ERROR_CODES.VALIDATION, DEFAULT_ERROR_MESSAGES.VALIDATION, fieldErrors),
    values,
  );
}

function savedToast(result: Extract<CastBallotResult, { status: "saved" }>): FlashToastKey {
  if (result.closed === null) return "vote-saved";
  return result.closed.status === "CLOSED" ? "vote-saved-closed" : "vote-saved-tie";
}

/**
 * "Gem min stemme" / "Opdatér min stemme". saved → pollHref + "vote-saved"
 * (closed CLOSED → "vote-saved-closed", AWAITING_DECISION → "vote-saved-tie");
 * closed → pollHref + "poll-locked" (E6); not-member / not-found → notFound();
 * invalid → field errors (ballotMessage).
 *
 * Fields: clubId, pollId (hidden), dateOptionIds[], noDateWorks,
 * placeOptionId. Whether voting is still open, the voter's membership and the
 * ballot's completeness are decided under the poll lock (castBallot); the
 * last missing ballot closes the poll in the same transaction (E8).
 */
export async function castBallotAction(
  _previous: BallotFormState,
  formData: FormData,
): Promise<BallotFormState> {
  const ids = parsePollRef(formData);
  const values = readBallotFormValues(formData);
  const parsed = ballotSchema.safeParse(values);
  if (!parsed.success) return failed(validationError(parsed.error), values);

  const { user, membership, club, poll } = await requirePoll(ids.clubId, ids.pollId);
  if (!canVote(membership)) {
    return failed(fail(ACTION_ERROR_CODES.FORBIDDEN, NOT_ALLOWED_TO_VOTE), values);
  }

  let result: CastBallotResult;
  try {
    result = await castBallot({
      clubId: club.id,
      pollId: poll.id,
      userId: user.id,
      now: new Date(),
      choice: parsed.data,
    });
  } catch (error) {
    console.error("[polls] castBallot failed", error);
    return failed(unexpectedError(), values);
  }

  switch (result.status) {
    case "not-found":
    case "not-member":
      notFound();
    case "invalid":
      return ballotFailure(result.errors, values);
    case "closed":
      // The vote came too late; castBallot may just have closed the poll (E6).
      revalidateClub(club.id);
      redirect(withToast(pollHref(club.id, poll.id), "poll-locked"));
    case "saved":
      revalidateClub(club.id);
      redirect(withToast(pollHref(club.id, poll.id), savedToast(result)));
  }
}
