import { isAdmin, type MembershipRole } from "@/server/domain/clubs/permissions";

/**
 * Songbook permissions (SPEC §5.1, §9.6): every member reads the songbook;
 * only admins add, edit and delete songs. A null membership (not a member)
 * is never allowed anything. The same function hides the buttons in the UI
 * and is enforced again by every Server Action (§4.4).
 *
 * Pure module: no Next.js, React or database imports. Client-safe.
 */

export function canManageSongs(membership: MembershipRole | null | undefined): boolean {
  return isAdmin(membership);
}

/** The refusal for a member who is not an admin (song form and PDF import). */
export const SONGS_FORBIDDEN_MESSAGE = "Kun klubbens admins kan ændre sangbogen.";
