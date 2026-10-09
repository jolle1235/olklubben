"use server";

import { revalidatePath } from "next/cache";
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
} from "@/lib/action-result";
import { isValidId } from "@/lib/ids";
import { createClubSchema, joinClubSchema } from "@/lib/validation/club";
import { createPasswordResetUrl } from "@/server/auth/reset-link";
import { requireMembership, requireUser } from "@/server/auth/session";
import {
  createClubWithAdmin,
  joinClubWithInviteCode,
  regenerateClubInvite,
  type JoinResult,
} from "@/server/clubs/mutations";
import { findClubMemberName, getResetLinkEligibility } from "@/server/clubs/queries";
import { INVITE_NOT_WORKING_CODE, INVITE_NOT_WORKING_MESSAGE } from "@/server/domain/clubs/invites";
import {
  canGeneratePasswordResetLink,
  canRegenerateInvite,
  canResetMemberPassword,
} from "@/server/domain/clubs/permissions";
import { rateLimit } from "@/server/rate-limit";

/**
 * Server Actions for clubs, joining and invitations (SPEC §4.3, §7.1–7.3,
 * §6.4). Every action re-checks the user and, for club actions, the
 * membership and role on the server: hidden buttons are only UX (§4.4).
 */

/** Ids from the client are untrusted: malformed → 404, like a club you cannot see. */
const idSchema = z.string().refine(isValidId);

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
  revalidatePath("/", "layout");
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

  revalidatePath("/", "layout");
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

  revalidatePath(`/c/${club.id}`, "layout");
  return ok();
}

export type MemberResetLink = {
  url: string;
  /** The member's name, for "Del det kun med <navn>". */
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
  const name = await findClubMemberName(club.id, parsed.data.userId);
  if (name === null) notFound();

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
