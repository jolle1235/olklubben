/**
 * Invitation rules (SPEC §7.3, E17, E18).
 *
 * Pure module: no Next.js, React or database imports (client-safe).
 */

/** ActionError code when a join fails on an unknown, revoked or expired code (E18). */
export const INVITE_NOT_WORKING_CODE = "INVITE_NOT_WORKING";

/** The message for an unknown, malformed or revoked code (E18). */
export const INVITE_NOT_WORKING_MESSAGE = "Koden virker ikke længere. Spørg efter et nyt link.";

/** The parts of an Invite row that decide whether it can still be used. */
export type InviteValidity = {
  revokedAt: Date | null;
  /** [SENERE] Not set by the app yet, but honoured when present. */
  expiresAt: Date | null;
};

/** True when the code can still be used to join: not revoked and not expired. */
export function isInviteActive(invite: InviteValidity, now: Date = new Date()): boolean {
  if (invite.revokedAt !== null) return false;
  if (invite.expiresAt !== null && invite.expiresAt.getTime() <= now.getTime()) return false;
  return true;
}
