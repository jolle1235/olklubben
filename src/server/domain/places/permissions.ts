import { isAdmin, type MembershipRole } from "@/server/domain/clubs/permissions";

/**
 * Place permissions (SPEC §5.1, §9.4, D-100).
 *
 *   * Every member may create places and edit name, address and description,
 *     archived places too (the democratic model of §9.4).
 *   * Ownership is self-claimed: a member sets or removes only themself.
 *     Admins may remove other owners (clean-up).
 *   * Removing a place is ONE action (placeRemoval): a used place (events or
 *     poll options, D-132) is archived, an unused one deleted. Archive: owner
 *     or admin (§5.1). Delete unused: owner, admin or the place's creator
 *     (typo clean-up).
 *   * A place in a poll that is not finished (OPEN or AWAITING_DECISION) can
 *     be neither archived nor deleted (E5, placeRemovalBlock).
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

/**
 * How much a place is used (D-100 → D-132): its events, its poll options (any
 * status) and the polls that are not finished (OPEN or AWAITING_DECISION).
 */
export type PlaceUsage = { eventCount: number; pollOptionCount: number; activePollCount: number };

/** Why a place cannot be removed right now. */
export type PlaceRemovalBlock = "in-active-poll";

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

/** Never used by an event or a poll (any status): it may be deleted. */
export function isPlaceUnused(usage: PlaceUsage): boolean {
  return usage.eventCount === 0 && usage.pollOptionCount === 0;
}

export function placeRemoval(usage: PlaceUsage): PlaceRemoval {
  return isPlaceUnused(usage) ? "delete" : "archive";
}

/** E5: a place in an OPEN or AWAITING_DECISION poll can be neither archived nor deleted. */
export function placeRemovalBlock(usage: PlaceUsage): PlaceRemovalBlock | null {
  return usage.activePollCount > 0 ? "in-active-poll" : null;
}

/**
 * The one removal button (archive when used, delete when not). Not for an
 * archived place (restore it instead), and not while it is in a poll that is
 * not finished (E5).
 */
export function canRemovePlace(
  membership: Membership,
  place: PlaceAccess,
  userId: string,
  usage: PlaceUsage,
): boolean {
  if (membership == null || place.archivedAt !== null) return false;
  if (placeRemovalBlock(usage) !== null) return false;
  return (
    isAdmin(membership) ||
    isPlaceOwner(place, userId) ||
    (isPlaceUnused(usage) && place.createdById === userId)
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
