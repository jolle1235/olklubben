"use server";

import { notFound, redirect } from "next/navigation";

import {
  ACTION_ERROR_CODES,
  fail,
  ok,
  unexpectedError,
  type ActionError,
  type ActionResult,
} from "@/lib/action-result";
import { withToast } from "@/lib/flash-toast";
import { idSchema } from "@/lib/validation/id";
import { memberRefSchema, setMemberRoleSchema } from "@/lib/validation/club";
import { requireMembership } from "@/server/auth/session";
import {
  changeMemberRole,
  ClubGoneError,
  leaveClub,
  removeMember,
} from "@/server/clubs/membership";
import {
  MEMBERSHIP_MESSAGES,
  type MembershipDecision,
  type MembershipRefusal,
} from "@/server/domain/clubs/membership-rules";
import { canManageMembers, type ClubRole } from "@/server/domain/clubs/permissions";
import { revalidateAppShell, revalidateClub } from "@/server/revalidate";
import { homePathAfterLeaving } from "@/server/users/queries";

/**
 * Server Actions for the club's members (SPEC §5.1, §7.4, §9.8; E1–E3, E25;
 * D-102): promote, demote, remove and leave.
 *
 * Order (§4.3): ids (malformed → 404) → membership (not a member → 404) →
 * canManageMembers → the data layer, which decides again under the club lock
 * with the roster read there (src/server/clubs/membership.ts), so the last
 * admin always stays. Its decision maps to:
 *   NOT_FOUND / ClubGoneError → 404 (fx another club's user for "Gør til admin")
 *   FORBIDDEN, LAST_ADMIN, ONLY_MEMBER, USE_LEAVE → a Danish message (§7.4)
 * Removing someone who is no longer a member is a no-op that succeeds.
 *
 * The menu actions return a result (the client toasts with the name);
 * "Forlad klubben" redirects home with a toast (D-104).
 */

type MembershipKind = "setRole" | "remove" | "leave";

/** A refusal as a result; NOT_FOUND is a 404 (the user or the club is not there). */
function refusal(
  reason: MembershipRefusal,
  kind: MembershipKind,
): { ok: false; error: ActionError } {
  switch (reason) {
    case "NOT_FOUND":
      return notFound();
    case "FORBIDDEN":
      return fail(ACTION_ERROR_CODES.FORBIDDEN, MEMBERSHIP_MESSAGES.FORBIDDEN);
    case "LAST_ADMIN":
      return fail(
        ACTION_ERROR_CODES.LAST_ADMIN,
        kind === "leave" ? MEMBERSHIP_MESSAGES.LAST_ADMIN_LEAVE : MEMBERSHIP_MESSAGES.LAST_ADMIN,
      );
    case "ONLY_MEMBER":
      return fail(ACTION_ERROR_CODES.ONLY_MEMBER, MEMBERSHIP_MESSAGES.ONLY_MEMBER);
    case "USE_LEAVE":
      return fail(ACTION_ERROR_CODES.USE_LEAVE, MEMBERSHIP_MESSAGES.USE_LEAVE);
  }
}

/** Runs a membership change; a club deleted meanwhile is a 404, anything else the generic error. */
async function decide(
  label: string,
  change: () => Promise<MembershipDecision>,
): Promise<MembershipDecision | { ok: false; error: ActionError }> {
  try {
    return await change();
  } catch (error) {
    if (error instanceof ClubGoneError) notFound();
    console.error(`[members] ${label} failed`, error);
    return unexpectedError();
  }
}

/**
 * "Gør til admin" / "Fjern admin-rollen" (admins; also on yourself while
 * another admin stays). The target must be a member of THIS club (→ 404).
 */
export async function setMemberRoleAction(
  clubId: string,
  userId: string,
  role: ClubRole,
): Promise<ActionResult> {
  const parsed = setMemberRoleSchema.safeParse({ clubId, userId, role });
  if (!parsed.success) notFound();

  const { user, membership, club } = await requireMembership(parsed.data.clubId);
  if (!canManageMembers(membership)) return refusal("FORBIDDEN", "setRole");

  const decision = await decide("changeMemberRole", () =>
    changeMemberRole({
      clubId: club.id,
      actorUserId: user.id,
      targetUserId: parsed.data.userId,
      role: parsed.data.role,
    }),
  );
  if ("error" in decision) return decision;
  if (!decision.ok) return refusal(decision.reason, "setRole");

  revalidateClub(club.id);
  return ok();
}

/**
 * "Fjern fra klubben" (admins, never yourself and never the last admin). The
 * member loses access at once (E16); their ratings, beers and events stay,
 * their place ownerships go and so do their hostships on events that have
 * not started (§7.4, D-098).
 */
export async function removeMemberAction(clubId: string, userId: string): Promise<ActionResult> {
  const parsed = memberRefSchema.safeParse({ clubId, userId });
  if (!parsed.success) notFound();

  const { user, membership, club } = await requireMembership(parsed.data.clubId);
  if (!canManageMembers(membership)) return refusal("FORBIDDEN", "remove");

  const decision = await decide("removeMember", () =>
    removeMember({
      clubId: club.id,
      actorUserId: user.id,
      targetUserId: parsed.data.userId,
      now: new Date(),
    }),
  );
  if ("error" in decision) return decision;
  if (!decision.ok) return refusal(decision.reason, "remove");

  revalidateClub(club.id);
  return ok();
}

/**
 * "Forlad klubben" (§7.4): refused for the last admin (E2, with the shortcut
 * "Gør et medlem til admin" on the page) and the only member (E3, who can
 * delete the club instead). Afterwards home – onboarding, the one remaining
 * club or the club picker – with a toast (D-104).
 */
export async function leaveClubAction(clubId: string): Promise<ActionResult> {
  const parsed = idSchema.safeParse(clubId);
  if (!parsed.success) notFound();

  const { user, club } = await requireMembership(parsed.data);

  const decision = await decide("leaveClub", () =>
    leaveClub({ clubId: club.id, userId: user.id, now: new Date() }),
  );
  if ("error" in decision) return decision;
  if (!decision.ok) return refusal(decision.reason, "leave");

  // The club list in every ClubSwitcher changed.
  revalidateAppShell();
  redirect(withToast(await homePathAfterLeaving(user.id), "club-left"));
}
