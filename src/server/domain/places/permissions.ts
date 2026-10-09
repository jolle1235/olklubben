import { isAdmin, type MembershipRole } from "@/server/domain/clubs/permissions";

/**
 * Place permissions (SPEC §5.1, §9.4, D-100).
 *
 *   * Every member may create places and edit name, address and description,
 *     archived places too (the democratic model of §9.4).
 *   * Ownership is self-claimed: a member sets or removes only themself.
 *     Admins may remove other owners (clean-up).
 *   * Removing a place is ONE action (placeRemoval): a used place is archived,
 *     an unused one deleted. Archive: owner or admin (§5.1). Delete unused:
 *     owner, admin or the place's creator (typo clean-up).
 *   * Restoring an archived place: owner or admin.
 *
 * The same functions hide buttons in the UI and enforce the rule on the server
 * (the data layer decides removal again under a row lock). A null membership
 * (not a member) is never allowed anything.
 *
 * Pure module: no Next.js, React or database imports. Client-safe.
 */

type Membership = MembershipRole | null | undefined;

/** The part of a place the checks need. */
export type PlaceAccess = {
  createdById: string;
  ownerIds: readonly string[];
  archivedAt: Date | null;
};

/** How much a place is used. Round 4 adds open polls (an open poll blocks archiving, E5). */
export type PlaceUsage = { eventCount: number };

/** What "remove" does to a place: unused → deleted, used → archived (§9.4). */
export type PlaceRemoval = "delete" | "archive";

export function canCreatePlace(membership: Membership): boolean {
  return membership != null;
}

/** Name, address and description: every member, also on an archived place (§9.4). */
export function canEditPlace(membership: Membership): boolean {
  return membership != null;
}

/** "Det er mit sted" / "Fjern mig som ejer": every member, for themself only. */
export function canSetOwnOwnership(membership: Membership): boolean {
  return membership != null;
}

export function isPlaceOwner(place: Pick<PlaceAccess, "ownerIds">, userId: string): boolean {
  return place.ownerIds.includes(userId);
}

/** Removing an owner: yourself, or anyone if you are an admin. */
export function canRemovePlaceOwner(
  membership: Membership,
  actorUserId: string,
  ownerUserId: string,
): boolean {
  return membership != null && (ownerUserId === actorUserId || isAdmin(membership));
}

export function placeRemoval(usage: PlaceUsage): PlaceRemoval {
  return usage.eventCount > 0 ? "archive" : "delete";
}

/**
 * The one removal button (archive when used, delete when not). Not for an
 * archived place (restore it instead).
 */
export function canRemovePlace(
  membership: Membership,
  place: PlaceAccess,
  userId: string,
  usage: PlaceUsage,
): boolean {
  if (membership == null || place.archivedAt !== null) return false;
  return (
    isAdmin(membership) ||
    isPlaceOwner(place, userId) ||
    (usage.eventCount === 0 && place.createdById === userId)
  );
}

export function canRestorePlace(
  membership: Membership,
  place: PlaceAccess,
  userId: string,
): boolean {
  if (membership == null || place.archivedAt === null) return false;
  return isAdmin(membership) || isPlaceOwner(place, userId);
}
