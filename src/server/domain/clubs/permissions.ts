/**
 * Club permissions (SPEC §5.1, D-018).
 *
 * Rights depend only on Membership.role: there is no owner role and no
 * Club.createdById with special rights. The same functions hide buttons in the
 * UI and enforce the rule on the server (the server is authoritative, §4.4).
 *
 * Pure module: no Next.js, React or database imports.
 */

/** Same values as the Prisma enum ClubRole. */
export type ClubRole = "ADMIN" | "MEMBER";

export const CLUB_ROLES: readonly ClubRole[] = ["ADMIN", "MEMBER"];

/** The part of a Membership the permission checks need. */
export type MembershipRole = { role: ClubRole };

/** Danish label for a role, e.g. on the member list. */
export const CLUB_ROLE_LABEL: Record<ClubRole, string> = {
  ADMIN: "Admin",
  MEMBER: "Medlem",
};

export function isAdmin(membership: MembershipRole | null | undefined): boolean {
  return membership?.role === "ADMIN";
}

/** Every member may see and share the club's invitation link (SPEC §7.3, Q9). */
export function canViewInvite(membership: MembershipRole | null | undefined): boolean {
  return membership != null;
}

/** Only admins may generate a new code; the old one stops working (SPEC §7.3). */
export function canRegenerateInvite(membership: MembershipRole | null | undefined): boolean {
  return isAdmin(membership);
}

/** Only admins may create a one-time password reset link for a member (SPEC §6.4). */
export function canGeneratePasswordResetLink(
  membership: MembershipRole | null | undefined,
): boolean {
  return isAdmin(membership);
}

/**
 * Whether an admin may make a reset link for this member (SPEC §6.4, §5.1).
 * Checked after canGeneratePasswordResetLink() and "the target is a member of
 * this club". The link sets a new password for the whole account, so:
 *
 * - every club the target is in must be one where the caller is admin.
 *   Otherwise an admin of a small club could take over the account of someone
 *   who is also in other clubs (club isolation, §3.3, §4.4);
 * - the target must not log in with Google (or another external provider):
 *   Google users need no reset (§6.4), and Better Auth would silently add a
 *   password login to the account.
 *
 * The caller shows ONE generic refusal for both reasons, so it never reveals
 * that the member is in other clubs.
 */
export function canResetMemberPassword(target: {
  targetHasClubWhereCallerIsNotAdmin: boolean;
  targetHasExternalLogin: boolean;
}): boolean {
  return !target.targetHasClubWhereCallerIsNotAdmin && !target.targetHasExternalLogin;
}
