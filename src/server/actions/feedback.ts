"use server";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import {
  ACTION_ERROR_CODES,
  fail,
  formatWait,
  ok,
  unexpectedError,
  validationError,
  type ActionError,
  type ActionResult,
  type FormFailure,
} from "@/lib/action-result";
import { withToast } from "@/lib/flash-toast";
import { readFormValues } from "@/lib/form-data";
import { feedbackHref, feedbackListHref } from "@/lib/routes";
import { stripNul } from "@/lib/text";
import {
  FEEDBACK_USER_AGENT_MAX_LENGTH,
  feedbackEditSchema,
  feedbackFormSchema,
  feedbackModerationSchema,
  feedbackRefSchema,
  feedbackVoteSchema,
} from "@/lib/validation/feedback";
import { requireUser } from "@/server/auth/session";
import {
  canDeleteFeedback,
  canEditFeedback,
  canModerateFeedback,
  canVoteOnFeedback,
} from "@/server/domain/feedback/permissions";
import { requireFeedback } from "@/server/feedback/access";
import {
  createFeedback,
  deleteFeedback,
  moderateFeedback,
  setFeedbackVote,
  updateFeedback,
  type FeedbackModerationResult,
  type FeedbackWriteResult,
} from "@/server/feedback/mutations";
import { rateLimit } from "@/server/rate-limit";
import { revalidateFeedback } from "@/server/revalidate";

/**
 * Server Actions for feedback (SPEC §9.9, §4.3, D-141–D-146).
 *
 * Feedback is app-wide: there is no club and no membership, only a logged-in
 * user (requireUser / requireFeedback) and the app-admin flag from
 * APP_ADMIN_EMAILS (D-142). Every action re-checks on the server, in this
 * order: ids (malformed → 404), the shared Zod schema, the session and the
 * report (unknown → 404), the can* rule (→ FORBIDDEN: a report is public, so a
 * missing right is not hidden behind a 404), then the data layer, which
 * repeats the rule inside the write (D-145).
 *
 * The forms take FormData (useActionState / useActionForm), so they work
 * without JavaScript; success redirects with a `?toast=` flag. The 👍 toggle
 * returns a result instead (optimistic UI, like the place-owner toggle).
 */

/** At most 10 reports per user per 24 hours (§9.9 "Misbrug og grænser"). */
const CREATE_FEEDBACK_LIMIT = { limit: 10, windowSeconds: 24 * 60 * 60 };

const FEEDBACK_TEXT_FIELDS = ["type", "title", "description", "pagePath", "viewportWidth"] as const;
const MODERATION_TEXT_FIELDS = ["status", "adminResponse", "duplicateOfId"] as const;

/** What was typed, echoed back after a failed submit (React resets the uncontrolled form). */
export type FeedbackFormValues = Partial<Record<(typeof FEEDBACK_TEXT_FIELDS)[number], string>>;
export type FeedbackModerationValues = Partial<
  Record<(typeof MODERATION_TEXT_FIELDS)[number], string>
>;

/** null before the first submit. Success redirects, so only failures come back. */
export type FeedbackFormState = FormFailure<FeedbackFormValues> | null;
export type FeedbackModerationState = FormFailure<FeedbackModerationValues> | null;

/** Generous: a too long text must come back whole, so it can be shortened (D-090 caps parse). */
const MAX_ECHO_LENGTH = 6000;

const FORBIDDEN_EDIT =
  "Kun den, der skrev rapporten (mens den er ny), og app-admins kan rette den.";
const FORBIDDEN_DELETE =
  "Kun den, der skrev rapporten (mens den er ny), og app-admins kan slette den.";
const FORBIDDEN_MODERATE = "Kun app-admins kan ændre status, svare og markere dubletter.";
const FORBIDDEN_OWN_VOTE = "Du kan ikke stemme på din egen rapport – den tæller allerede som 1 👍.";
const LOCKED_EDIT = "Rapporten er ikke længere ny, så den kan ikke rettes.";
const LOCKED_DELETE = "Rapporten er ikke længere ny, så den kan ikke slettes.";
const DUPLICATE_TARGET_MISSING = "Den originale rapport findes ikke længere.";
const DUPLICATE_TARGET_IS_DUPLICATE = "Vælg den originale rapport, ikke en anden dublet.";

function rateLimitedMessage(retryAfterSeconds: number): string {
  return (
    `Du kan sende højst ${CREATE_FEEDBACK_LIMIT.limit} rapporter i døgnet. ` +
    `Prøv igen om ${formatWait(retryAfterSeconds)}.`
  );
}

function readValues<F extends string>(
  formData: FormData,
  fields: readonly F[],
): Partial<Record<F, string>> {
  const raw = readFormValues(formData);
  const values: Partial<Record<F, string>> = {};
  for (const field of fields) {
    const value = raw[field];
    if (typeof value === "string") values[field] = value.slice(0, MAX_ECHO_LENGTH);
  }
  return values;
}

function failed<V>(result: { ok: false; error: ActionError }, values: V): FormFailure<V> {
  return { ...result, values };
}

/** The request's browser, kept for bug reports only (app-admins see it, §9.9). */
async function requestUserAgent(): Promise<string | null> {
  const raw = (await headers()).get("user-agent");
  if (!raw) return null;
  const value = stripNul(raw).trim().slice(0, FEEDBACK_USER_AGENT_MAX_LENGTH).trim();
  return value === "" ? null : value;
}

/** The data layer's "no row written" answers. "not-found": deleted meanwhile → 404. */
function writeRefusal(
  result: Exclude<FeedbackWriteResult, "ok">,
  messages: { forbidden: string; locked: string },
): { ok: false; error: ActionError } {
  if (result === "not-found") notFound();
  return result === "locked"
    ? fail(ACTION_ERROR_CODES.FEEDBACK_LOCKED, messages.locked)
    : fail(ACTION_ERROR_CODES.FORBIDDEN, messages.forbidden);
}

/**
 * "Send" on /feedback/new. Form fields: type, title, description, pagePath
 * (bugs), viewportWidth (hidden, bugs). The user agent is read from the
 * request (never from the form). Opens the new report.
 */
export async function createFeedbackAction(
  _previous: FeedbackFormState,
  formData: FormData,
): Promise<FeedbackFormState> {
  const values = readValues(formData, FEEDBACK_TEXT_FIELDS);
  const parsed = feedbackFormSchema.safeParse(values);
  if (!parsed.success) return failed(validationError(parsed.error), values);

  const user = await requireUser();
  const limited = await rateLimit(`feedback:create:user:${user.id}`, CREATE_FEEDBACK_LIMIT);
  if (!limited.ok) {
    return failed(
      fail(ACTION_ERROR_CODES.RATE_LIMITED, rateLimitedMessage(limited.retryAfterSeconds)),
      values,
    );
  }

  const userAgent = parsed.data.type === "BUG" ? await requestUserAgent() : null;
  let feedbackId: string;
  try {
    ({ id: feedbackId } = await createFeedback(user.id, { ...parsed.data, userAgent }));
  } catch (error) {
    console.error("[feedback] createFeedback failed", error);
    return failed(unexpectedError(), values);
  }

  revalidateFeedback();
  redirect(withToast(feedbackHref(feedbackId), "feedback-created"));
}

/**
 * "Gem" on /feedback/[feedbackId]/edit: title and description. The author
 * while the report is NEW, or an app-admin. Form fields: feedbackId (hidden),
 * title, description.
 */
export async function updateFeedbackAction(
  _previous: FeedbackFormState,
  formData: FormData,
): Promise<FeedbackFormState> {
  const ref = feedbackRefSchema.safeParse({ feedbackId: formData.get("feedbackId") });
  if (!ref.success) notFound();

  const values = readValues(formData, FEEDBACK_TEXT_FIELDS);
  const parsed = feedbackEditSchema.safeParse({ ...values, feedbackId: ref.data.feedbackId });
  if (!parsed.success) return failed(validationError(parsed.error), values);

  const { viewer, feedback } = await requireFeedback(ref.data.feedbackId);
  if (!canEditFeedback(viewer, feedback)) {
    const locked = feedback.createdById === viewer.userId;
    return failed(
      locked
        ? fail(ACTION_ERROR_CODES.FEEDBACK_LOCKED, LOCKED_EDIT)
        : fail(ACTION_ERROR_CODES.FORBIDDEN, FORBIDDEN_EDIT),
      values,
    );
  }

  let result: FeedbackWriteResult;
  try {
    result = await updateFeedback(viewer, feedback.id, {
      title: parsed.data.title,
      description: parsed.data.description,
    });
  } catch (error) {
    console.error("[feedback] updateFeedback failed", error);
    return failed(unexpectedError(), values);
  }
  if (result !== "ok") {
    return failed(writeRefusal(result, { forbidden: FORBIDDEN_EDIT, locked: LOCKED_EDIT }), values);
  }

  revalidateFeedback();
  redirect(withToast(feedbackHref(feedback.id), "feedback-updated"));
}

/**
 * "Slet rapport" on the report's page (after the ConfirmDialog). The author
 * while NEW, or an app-admin. → the list.
 */
export async function deleteFeedbackAction(feedbackId: string): Promise<ActionResult> {
  const ref = feedbackRefSchema.safeParse({ feedbackId });
  if (!ref.success) notFound();

  const { viewer, feedback } = await requireFeedback(ref.data.feedbackId);
  if (!canDeleteFeedback(viewer, feedback)) {
    return feedback.createdById === viewer.userId
      ? fail(ACTION_ERROR_CODES.FEEDBACK_LOCKED, LOCKED_DELETE)
      : fail(ACTION_ERROR_CODES.FORBIDDEN, FORBIDDEN_DELETE);
  }

  let result: FeedbackWriteResult;
  try {
    result = await deleteFeedback(viewer, feedback.id);
  } catch (error) {
    console.error("[feedback] deleteFeedback failed", error);
    return unexpectedError();
  }
  if (result !== "ok") {
    return writeRefusal(result, { forbidden: FORBIDDEN_DELETE, locked: LOCKED_DELETE });
  }

  // Redirect rather than return: the deleted report's page would render a 404.
  revalidateFeedback();
  redirect(withToast(feedbackListHref(), "feedback-deleted"));
}

/**
 * 👍 toggle ("Jeg har også det problem" / "Det vil jeg også gerne have"):
 * sets the CALLER's vote to the desired state (a double tap is harmless) and
 * returns the fresh count. Never on your own report. No redirect: optimistic.
 */
export async function setFeedbackVoteAction(input: {
  feedbackId: string;
  voted: boolean;
}): Promise<ActionResult<{ voted: boolean; voteCount: number }>> {
  const ref = feedbackRefSchema.safeParse({ feedbackId: input?.feedbackId });
  if (!ref.success) notFound();
  const parsed = feedbackVoteSchema.safeParse({ ...input, feedbackId: ref.data.feedbackId });
  if (!parsed.success) return validationError(parsed.error);

  const { viewer, feedback } = await requireFeedback(ref.data.feedbackId);
  if (!canVoteOnFeedback(viewer, feedback)) {
    return fail(ACTION_ERROR_CODES.FORBIDDEN, FORBIDDEN_OWN_VOTE);
  }

  let result: Awaited<ReturnType<typeof setFeedbackVote>>;
  try {
    result = await setFeedbackVote(viewer, feedback.id, parsed.data.voted);
  } catch (error) {
    console.error("[feedback] setFeedbackVote failed", error);
    return unexpectedError();
  }
  if (result.status === "not-found") notFound();
  if (result.status === "own") return fail(ACTION_ERROR_CODES.FORBIDDEN, FORBIDDEN_OWN_VOTE);

  revalidateFeedback();
  return ok({ voted: result.voted, voteCount: result.voteCount });
}

function moderationRefusal(result: Exclude<FeedbackModerationResult, "ok">): {
  ok: false;
  error: ActionError;
} {
  switch (result) {
    case "not-found":
      return notFound();
    case "forbidden":
      return fail(ACTION_ERROR_CODES.FORBIDDEN, FORBIDDEN_MODERATE);
    case "duplicate-target-missing":
      return fail(ACTION_ERROR_CODES.VALIDATION, DUPLICATE_TARGET_MISSING, {
        duplicateOfId: [DUPLICATE_TARGET_MISSING],
      });
    case "duplicate-target-is-duplicate":
      return fail(ACTION_ERROR_CODES.VALIDATION, DUPLICATE_TARGET_IS_DUPLICATE, {
        duplicateOfId: [DUPLICATE_TARGET_IS_DUPLICATE],
      });
  }
}

/**
 * "Gem status" (app-admins, §9.9 "Detaljeside", E28): status, a short answer
 * and, for DUPLICATE, the original. Form fields: feedbackId (hidden), status,
 * adminResponse, duplicateOfId. Votes are never moved.
 */
export async function moderateFeedbackAction(
  _previous: FeedbackModerationState,
  formData: FormData,
): Promise<FeedbackModerationState> {
  const ref = feedbackRefSchema.safeParse({ feedbackId: formData.get("feedbackId") });
  if (!ref.success) notFound();

  const values = readValues(formData, MODERATION_TEXT_FIELDS);
  const parsed = feedbackModerationSchema.safeParse({ ...values, feedbackId: ref.data.feedbackId });
  if (!parsed.success) return failed(validationError(parsed.error), values);

  const { viewer, feedback } = await requireFeedback(ref.data.feedbackId);
  if (!canModerateFeedback(viewer)) {
    return failed(fail(ACTION_ERROR_CODES.FORBIDDEN, FORBIDDEN_MODERATE), values);
  }

  let result: FeedbackModerationResult;
  try {
    result = await moderateFeedback(viewer, parsed.data);
  } catch (error) {
    console.error("[feedback] moderateFeedback failed", error);
    return failed(unexpectedError(), values);
  }
  if (result !== "ok") return failed(moderationRefusal(result), values);

  revalidateFeedback();
  redirect(withToast(feedbackHref(feedback.id), "feedback-moderated"));
}
