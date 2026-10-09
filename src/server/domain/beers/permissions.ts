import { isAdmin, type MembershipRole } from "@/server/domain/clubs/permissions";

/**
 * Beer permissions (SPEC §5.1, D-063).
 *
 * Every member may add beers and rate them (their own rating). Editing and
 * deleting a beer: its creator or an admin. A null membership (not a member)
 * is never allowed anything. The same functions hide buttons and enforce the
 * rule on the server (§4.4).
 *
 * Pure module: no Next.js, React or database imports. Client-safe.
 */

/** The part of a beer the checks need. */
export type BeerOwnership = { createdById: string };

export function canAddBeer(membership: MembershipRole | null | undefined): boolean {
  return membership != null;
}

export function canRateBeer(membership: MembershipRole | null | undefined): boolean {
  return membership != null;
}

export function canEditBeer(
  membership: MembershipRole | null | undefined,
  beer: BeerOwnership,
  userId: string,
): boolean {
  if (membership == null) return false;
  return isAdmin(membership) || beer.createdById === userId;
}

export function canDeleteBeer(
  membership: MembershipRole | null | undefined,
  beer: BeerOwnership,
  userId: string,
): boolean {
  return canEditBeer(membership, beer, userId);
}
