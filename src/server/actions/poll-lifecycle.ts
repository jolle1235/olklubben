"use server";

import { notFound, redirect } from "next/navigation";

import {
  ACTION_ERROR_CODES,
  DEFAULT_ERROR_MESSAGES,
  fail,
  unexpectedError,
  validationError,
  type ActionError,
  type ActionResult,
  type FieldErrors,
  type FormFailure,
} from "@/lib/action-result";
import { withToast } from "@/lib/flash-toast";
import { readFormValues } from "@/lib/form-data";
import { pollHref } from "@/lib/routes";
import { pollRefSchema, TIE_CHOICE_MESSAGES, tieChoiceSchema } from "@/lib/validation/poll";
import type { PollCategory } from "@/server/domain/polls/options";
import { canManagePoll } from "@/server/domain/polls/permissions";
import { requirePoll } from "@/server/polls/access";
import {
  cancelPoll,
  closePollManually,
  resolvePollTie,
  type CancelPollResult,
  type ClosePollManuallyResult,
  type ResolvePollTieResult,
} from "@/server/polls/mutations";
import { revalidateClub } from "@/server/revalidate";

/**
 * Server Actions for ending a poll (SPEC §9.7.4–§9.7.6, D-008, D-131).
 *
 * Order (§4.3, D-127): ids (pollRefSchema → 404) → Zod → requirePoll
 * (membership + same club, E22) → canManagePoll (FORBIDDEN) → data layer
 * (src/server/polls/mutations.ts, which re-checks the role AND the state under
 * the poll lock) → revalidateClub → redirect.
 *
 * A creator who has left the club is not a member, so requirePoll already
 * gives a 404 (E11); the admins can still act. The page's own state check is
 * only UX: a poll that another tab (or the lazy close) has already ended gives
 * already-final / not-awaiting, and the action simply opens the poll again
 * without a toast, so a double submit is harmless (idempotent).
 *
 * Forbidden messages (D-117):
 *   "Kun opretteren og klubbens admins kan afslutte afstemningen."
 *   "Kun opretteren og klubbens admins kan annullere afstemningen."
 *   "Kun opretteren og klubbens admins kan vælge vinderen."
 */

const NOT_ALLOWED_TO_CLOSE = "Kun opretteren og klubbens admins kan afslutte afstemningen.";
const NOT_ALLOWED_TO_CANCEL = "Kun opretteren og klubbens admins kan annullere afstemningen.";
const NOT_ALLOWED_TO_RESOLVE = "Kun opretteren og klubbens admins kan vælge vinderen.";

const TIE_FIELDS = ["dateOptionId", "placeOptionId"] as const;

/** The radio group of a tied category in the TieResolver form. */
const TIE_FIELD: Record<PollCategory, (typeof TIE_FIELDS)[number]> = {
  DATE: "dateOptionId",
  PLACE: "placeOptionId",
};

export type TieFormValues = { dateOptionId?: string; placeOptionId?: string };
export type TieFormState = FormFailure<TieFormValues> | null;

/** The ids of a ConfirmDialog action (malformed → 404, like a forged URL). */
function parseIds(clubId: unknown, pollId: unknown): { clubId: string; pollId: string } {
  const ids = pollRefSchema.safeParse({ clubId, pollId });
  if (!ids.success) notFound();
  return ids.data;
}

/**
 * "Afslut nu" in the ConfirmDialog (onConfirm). A clear winner closes the poll
 * and creates the event in the same transaction → "poll-closed"; a tie →
 * "poll-awaiting" (the page then shows "Vælg vinder"). An expired poll is
 * closed as DEADLINE by the data layer (what really ended it).
 */
export async function closePollAction(clubId: string, pollId: string): Promise<ActionResult> {
  const ids = parseIds(clubId, pollId);
  const { user, membership, club, poll } = await requirePoll(ids.clubId, ids.pollId);
  if (!canManagePoll(membership, poll, user.id)) {
    return fail(ACTION_ERROR_CODES.FORBIDDEN, NOT_ALLOWED_TO_CLOSE);
  }

  let result: ClosePollManuallyResult;
  try {
    result = await closePollManually({
      clubId: club.id,
      pollId: poll.id,
      actorUserId: user.id,
      now: new Date(),
    });
  } catch (error) {
    console.error("[polls] closePollManually failed", error);
    return unexpectedError();
  }

  switch (result.status) {
    case "not-found":
      notFound();
    case "forbidden":
      return fail(ACTION_ERROR_CODES.FORBIDDEN, NOT_ALLOWED_TO_CLOSE);
    case "already-final":
      redirect(pollHref(club.id, poll.id));
    case "closed":
      revalidateClub(club.id);
      redirect(
        withToast(
          pollHref(club.id, poll.id),
          result.outcome.status === "CLOSED" ? "poll-closed" : "poll-awaiting",
        ),
      );
  }
}

/**
 * "Annullér afstemning" in the ConfirmDialog (OPEN or AWAITING_DECISION). No
 * event is created and the ballots stay, so the club can still see them.
 */
export async function cancelPollAction(clubId: string, pollId: string): Promise<ActionResult> {
  const ids = parseIds(clubId, pollId);
  const { user, membership, club, poll } = await requirePoll(ids.clubId, ids.pollId);
  if (!canManagePoll(membership, poll, user.id)) {
    return fail(ACTION_ERROR_CODES.FORBIDDEN, NOT_ALLOWED_TO_CANCEL);
  }

  let result: CancelPollResult;
  try {
    result = await cancelPoll({
      clubId: club.id,
      pollId: poll.id,
      actorUserId: user.id,
      now: new Date(),
    });
  } catch (error) {
    console.error("[polls] cancelPoll failed", error);
    return unexpectedError();
  }

  switch (result.status) {
    case "not-found":
      notFound();
    case "forbidden":
      return fail(ACTION_ERROR_CODES.FORBIDDEN, NOT_ALLOWED_TO_CANCEL);
    case "already-final":
      redirect(pollHref(club.id, poll.id));
    case "cancelled":
      revalidateClub(club.id);
      redirect(withToast(pollHref(club.id, poll.id), "poll-cancelled"));
  }
}

function readTieValues(formData: FormData): TieFormValues {
  const raw = readFormValues(formData);
  const values: TieFormValues = {};
  for (const field of TIE_FIELDS) {
    const value = raw[field];
    if (typeof value === "string") values[field] = value;
  }
  return values;
}

function failed(result: { ok: false; error: ActionError }, values: TieFormValues): TieFormState {
  return { ...result, values };
}

/**
 * "Vælg vinder og opret event" after a tie (a real form, works without JS).
 * Fields: clubId, pollId (hidden), dateOptionId, placeOptionId (the radio
 * groups of the tied categories). The data layer checks the choice against the
 * tied options under the lock; a missing or foreign choice is that group's
 * field error (TIE_CHOICE_MESSAGES). Success opens the poll with
 * "poll-decided" (its outcome card links to the new event).
 */
export async function resolvePollTieAction(
  _previous: TieFormState,
  formData: FormData,
): Promise<TieFormState> {
  const ids = parseIds(formData.get("clubId"), formData.get("pollId"));
  const values = readTieValues(formData);
  const parsed = tieChoiceSchema.safeParse(values);
  if (!parsed.success) return failed(validationError(parsed.error), values);

  const { user, membership, club, poll } = await requirePoll(ids.clubId, ids.pollId);
  if (!canManagePoll(membership, poll, user.id)) {
    return failed(fail(ACTION_ERROR_CODES.FORBIDDEN, NOT_ALLOWED_TO_RESOLVE), values);
  }

  let result: ResolvePollTieResult;
  try {
    result = await resolvePollTie({
      clubId: club.id,
      pollId: poll.id,
      actorUserId: user.id,
      now: new Date(),
      choices: parsed.data,
    });
  } catch (error) {
    console.error("[polls] resolvePollTie failed", error);
    return failed(unexpectedError(), values);
  }

  switch (result.status) {
    case "not-found":
      notFound();
    case "forbidden":
      return failed(fail(ACTION_ERROR_CODES.FORBIDDEN, NOT_ALLOWED_TO_RESOLVE), values);
    case "not-awaiting":
      redirect(pollHref(club.id, poll.id));
    case "invalid-choice": {
      const fieldErrors: FieldErrors = {};
      for (const category of result.categories) {
        fieldErrors[TIE_FIELD[category]] = [TIE_CHOICE_MESSAGES[category]];
      }
      return failed(
        fail(ACTION_ERROR_CODES.VALIDATION, DEFAULT_ERROR_MESSAGES.VALIDATION, fieldErrors),
        values,
      );
    }
    case "closed":
      revalidateClub(club.id);
      redirect(withToast(pollHref(club.id, poll.id), "poll-decided"));
  }
}
