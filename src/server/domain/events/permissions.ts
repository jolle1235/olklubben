import { isAdmin, type MembershipRole } from "@/server/domain/clubs/permissions";

/**
 * Event permissions (SPEC §5.1, §9.2, D-098; replaces D-061).
 *
 * Every member may see and create events. Editing and deleting: the creator,
 * a host or an admin. A host who left the club has no membership and so no
 * rights, even while still listed as a host (history, §7.4).
 *
 * The same functions hide buttons in the UI and enforce the rule on the
 * server (the server is authoritative, §4.4). A null membership (not a
 * member) is never allowed anything.
 *
 * Pure module: no Next.js, React or database imports. Client-safe.
 */

/** The part of an event the checks need. */
export type EventOwnership = { createdById: string; hostIds: readonly string[] };

export function canCreateEvent(membership: MembershipRole | null | undefined): boolean {
  return membership != null;
}

export function canEditEvent(
  membership: MembershipRole | null | undefined,
  event: EventOwnership,
  userId: string,
): boolean {
  if (membership == null) return false;
  return isAdmin(membership) || event.createdById === userId || event.hostIds.includes(userId);
}

export function canDeleteEvent(
  membership: MembershipRole | null | undefined,
  event: EventOwnership,
  userId: string,
): boolean {
  return canEditEvent(membership, event, userId);
}
