"use server";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import {
  ACTION_ERROR_CODES,
  DEFAULT_ERROR_MESSAGES,
  fail,
  ok,
  rateLimitedError,
  unexpectedError,
  validationError,
  type ActionResult,
  type FormFailure,
} from "@/lib/action-result";
import { withToast } from "@/lib/flash-toast";
import { readFormValues } from "@/lib/form-data";
import { getDisplayName } from "@/lib/format/display-name";
import { clubHref } from "@/lib/routes";
import {
  CONFIRM_NAME_MISMATCH_MESSAGE,
  createClubSchema,
  deleteClubSchema,
  joinClubSchema,
  updateClubInfoSchema,
} from "@/lib/validation/club";
import { idSchema } from "@/lib/validation/id";
import { createPasswordResetUrl } from "@/server/auth/reset-link";
import { requireMembership, requireUser } from "@/server/auth/session";
import { ClubGoneError, deleteClub, updateClubInfo } from "@/server/clubs/membership";
import {
  createClubWithAdmin,
  joinClubWithInviteCode,
  regenerateClubInvite,
  type JoinResult,
} from "@/server/clubs/mutations";
import { findClubMember, getResetLinkEligibility } from "@/server/clubs/queries";
import { INVITE_NOT_WORKING_CODE, INVITE_NOT_WORKING_MESSAGE } from "@/server/domain/clubs/invites";
import {
  canDeleteClub,
  canEditClubInfo,
  canGeneratePasswordResetLink,
  canRegenerateInvite,
  canResetMemberPassword,
} from "@/server/domain/clubs/permissions";
import { rateLimit } from "@/server/rate-limit";
import { revalidateAppShell, revalidateClub } from "@/server/revalidate";
import { homePathAfterLeaving } from "@/server/users/queries";

/**
 * Server Actions for clubs, joining, invitations, club info and deleting the
 * club (SPEC §4.3, §7.1–7.3, §7.5, §6.4). Every action re-checks the user
 * and, for club actions, the membership and role on the server: hidden
 * buttons are only UX (§4.4). Members (roles, remove, leave) live in
 * members.ts.
 */

/** The form state for useActionState: null before the first submit. */
export type ClubFormState = ActionResult | null;

/**
 * Creates a club with the current user as Admin and its first invitation code,
 * then opens the club's Overblik (SPEC §7.2). Form field: `name`.
 */
export async function createClub(
  _previous: ClubFormState,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = createClubSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return validationError(parsed.error);

  const user = await requireUser();

  const limited = await rateLimit(`club:create:user:${user.id}`, {
    limit: 10,
    windowSeconds: 60 * 60,
  });
  if (!limited.ok) return rateLimitedError(limited.retryAfterSeconds);

  let clubId: string;
  try {
    ({ clubId } = await createClubWithAdmin({ userId: user.id, name: parsed.data.name }));
  } catch (error) {
    console.error("[clubs] createClub failed", error);
    return unexpectedError();
  }

  // The club list in every club's ClubSwitcher changed.
  revalidateAppShell();
  redirect(`/c/${clubId}`);
}

/**
 * Joins the club behind an invitation code (SPEC §7.2, §10.7) and opens its
 * Overblik. Already a member → straight into the club (E17). Unknown, revoked
 * or expired code → E18. Form field: `code` (any accepted spelling).
 */
export async function joinClub(
  _previous: ClubFormState,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = joinClubSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return validationError(parsed.error);

  const user = await requireUser();

  // SPEC §4.7: join-with-code is rate limited, so codes cannot be guessed.
  const limited = await rateLimit(`join:user:${user.id}`, { limit: 10, windowSeconds: 10 * 60 });
  if (!limited.ok) return rateLimitedError(limited.retryAfterSeconds);

  let result: JoinResult;
  try {
    result = await joinClubWithInviteCode({ userId: user.id, code: parsed.data.code });
  } catch (error) {
    console.error("[clubs] joinClub failed", error);
    return unexpectedError();
  }
  if (result.status === "invalid-code") {
    return fail(INVITE_NOT_WORKING_CODE, INVITE_NOT_WORKING_MESSAGE);
  }

  revalidateAppShell();
  redirect(`/c/${result.clubId}`);
}

/**
 * Admin only: replaces the club's invitation code. The old code and link stop
 * working (SPEC §7.3, §5.1).
 */
export async function regenerateInvite(clubId: string): Promise<ActionResult> {
  const parsedClubId = idSchema.safeParse(clubId);
  if (!parsedClubId.success) notFound();

  const { user, membership, club } = await requireMembership(parsedClubId.data);
  if (!canRegenerateInvite(membership)) {
    return fail(ACTION_ERROR_CODES.FORBIDDEN, "Kun admins kan generere en ny kode.");
  }

  try {
    await regenerateClubInvite({ clubId: club.id, createdById: user.id });
  } catch (error) {
    console.error("[clubs] regenerateInvite failed", error);
    return unexpectedError();
  }

  revalidateClub(club.id);
  return ok();
}

export type MemberResetLink = {
  url: string;
  /** The member's display name, for "Del det kun med <navn>". */
  name: string;
};

/**
 * Admin only: a one-time password reset link for a member of the same club
 * (SPEC §6.4, D-017). Valid for 1 hour and one use. The admin shares it, e.g.
 * in the group chat, when email is not set up.
 *
 * Only for members whose every club the admin administers, and never for an
 * account with a Google login (canResetMemberPassword). Both refusals give the
 * same message, so nothing reveals that the member is in other clubs (§3.3).
 */
export async function createMemberResetLink(
  clubId: string,
  userId: string,
): Promise<ActionResult<MemberResetLink>> {
  const parsed = z.object({ clubId: idSchema, userId: idSchema }).safeParse({ clubId, userId });
  if (!parsed.success) notFound();

  const { user, membership, club } = await requireMembership(parsed.data.clubId);
  if (!canGeneratePasswordResetLink(membership)) {
    return fail(ACTION_ERROR_CODES.FORBIDDEN, DEFAULT_ERROR_MESSAGES.FORBIDDEN);
  }

  // The target must be a member of THIS club (§4.4): otherwise it does not exist here.
  const member = await findClubMember(club.id, parsed.data.userId);
  if (member === null) notFound();
  const name = getDisplayName(member);

  // The link resets the whole account: refuse members of clubs the admin does
  // not run, and Google users. One generic message for both (never mention clubs).
  if (!canResetMemberPassword(await getResetLinkEligibility(user.id, parsed.data.userId))) {
    return fail(
      ACTION_ERROR_CODES.FORBIDDEN,
      `Du kan ikke lave et nulstillingslink til ${name}. Bed ${name} om at bruge "Glemt password" eller logge ind med Google.`,
    );
  }

  try {
    const url = await createPasswordResetUrl(parsed.data.userId);
    return ok({ url, name });
  } catch (error) {
    console.error("[clubs] createMemberResetLink failed", error);
    return unexpectedError();
  }
}

/** What was typed in "Rediger klubinfo", echoed back after a failed submit. */
export type ClubInfoFormValues = { name?: string; description?: string };

/** The form state for useActionState: null before the first submit. Success redirects. */
export type ClubInfoFormState = FormFailure<ClubInfoFormValues> | null;

const NOT_ALLOWED_TO_EDIT_CLUB = "Kun admins kan rette klubinfo.";
const NOT_ALLOWED_TO_DELETE_CLUB = "Kun admins kan slette klubben.";

/** An echoed value is capped, so a forged request cannot bounce megabytes back. */
const MAX_ECHO_LENGTH = 2000;

function readClubInfoValues(formData: FormData): ClubInfoFormValues {
  const raw = readFormValues(formData);
  const values: ClubInfoFormValues = {};
  for (const field of ["name", "description"] as const) {
    const value = raw[field];
    if (typeof value === "string") values[field] = value.slice(0, MAX_ECHO_LENGTH);
  }
  return values;
}

/**
 * Admin only: "Rediger klubinfo" (SPEC §7.1, D-110): the name (1–60) and the
 * description (optional, ≤ 300, line breaks kept). The name shows in every
 * member's ClubSwitcher, so the whole app shell is revalidated. Back to the
 * club page with a toast. Form fields: clubId (hidden), name, description.
 */
export async function updateClubInfoAction(
  _previous: ClubInfoFormState,
  formData: FormData,
): Promise<ClubInfoFormState> {
  const clubId = idSchema.safeParse(formData.get("clubId"));
  if (!clubId.success) notFound();

  const values = readClubInfoValues(formData);
  const parsed = updateClubInfoSchema.safeParse(values);
  if (!parsed.success) return { ...validationError(parsed.error), values };

  const { user, membership, club } = await requireMembership(clubId.data);
  if (!canEditClubInfo(membership)) {
    return { ...fail(ACTION_ERROR_CODES.FORBIDDEN, NOT_ALLOWED_TO_EDIT_CLUB), values };
  }

  let result: Awaited<ReturnType<typeof updateClubInfo>>;
  try {
    result = await updateClubInfo({ clubId: club.id, actorUserId: user.id, ...parsed.data });
  } catch (error) {
    if (error instanceof ClubGoneError) notFound();
    console.error("[clubs] updateClubInfo failed", error);
    return { ...unexpectedError(), values };
  }
  // The role is read again under the club lock: demoted meanwhile.
  if (!result.ok) {
    return { ...fail(ACTION_ERROR_CODES.FORBIDDEN, NOT_ALLOWED_TO_EDIT_CLUB), values };
  }

  revalidateAppShell();
  redirect(withToast(clubHref(club.id), "club-updated"));
}

/**
 * Admin only: "Slet klubben" (SPEC §7.5, D-103) after typing the club's name
 * (field confirmName). The data layer compares it with the name read under
 * the club lock; a mismatch is a field error on confirmName. Everything in
 * the club is deleted, the members' accounts stay. Afterwards home with a
 * toast (D-104).
 */
export async function deleteClubAction(clubId: string, formData: FormData): Promise<ActionResult> {
  const parsedClubId = idSchema.safeParse(clubId);
  if (!parsedClubId.success) notFound();

  const parsed = deleteClubSchema.safeParse(readFormValues(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { user, membership, club } = await requireMembership(parsedClubId.data);
  if (!canDeleteClub(membership)) {
    return fail(ACTION_ERROR_CODES.FORBIDDEN, NOT_ALLOWED_TO_DELETE_CLUB);
  }

  let result: Awaited<ReturnType<typeof deleteClub>>;
  try {
    result = await deleteClub({
      clubId: club.id,
      actorUserId: user.id,
      confirmName: parsed.data.confirmName,
    });
  } catch (error) {
    if (error instanceof ClubGoneError) notFound();
    console.error("[clubs] deleteClub failed", error);
    return unexpectedError();
  }
  if (!result.ok) {
    return result.reason === "NAME_MISMATCH"
      ? fail(ACTION_ERROR_CODES.NAME_MISMATCH, CONFIRM_NAME_MISMATCH_MESSAGE, {
          confirmName: [CONFIRM_NAME_MISMATCH_MESSAGE],
        })
      : fail(ACTION_ERROR_CODES.FORBIDDEN, NOT_ALLOWED_TO_DELETE_CLUB);
  }

  // The club list in every member's ClubSwitcher changed.
  revalidateAppShell();
  redirect(withToast(await homePathAfterLeaving(user.id), "club-deleted"));
}
