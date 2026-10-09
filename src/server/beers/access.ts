import "server-only";

import { notFound } from "next/navigation";

import { isValidId } from "@/lib/ids";
import {
  rememberActiveClub,
  requireMembership,
  type ClubInfo,
  type MembershipInfo,
  type SessionUser,
} from "@/server/auth/session";

import { getBeer, type BeerDetail } from "./queries";

/**
 * Access to one beer for its pages (SPEC §4.4, D-052, TG-008).
 *
 *   requireBeer(clubId, beerId)     membership + the beer in THIS club, else
 *                                   notFound(). Never writes, so it is safe in a
 *                                   layout (beers/[beerId]/layout.tsx).
 *   requireBeerPage(clubId, beerId) the same, then remembers the active club
 *                                   (requireClubPage for beer pages).
 *
 * Unknown, malformed and other-club ids all give 404 (E22), before the active
 * club changes. The edit page calls requireBeer, its permission check and
 * then rememberActiveClub, so its permission 404 does not change it either.
 * The beer comes with the current user's own rating. requireMembership and
 * getBeer are cached per request, so a layout and its page share the queries.
 */

export type BeerAccess = {
  user: SessionUser;
  membership: MembershipInfo;
  club: ClubInfo;
  beer: BeerDetail;
};

export async function requireBeer(clubId: string, beerId: string): Promise<BeerAccess> {
  const access = await requireMembership(clubId);
  if (!isValidId(beerId)) notFound();
  const beer = await getBeer(access.club.id, beerId, access.user.id);
  if (!beer) notFound();
  return { ...access, beer };
}

export async function requireBeerPage(clubId: string, beerId: string): Promise<BeerAccess> {
  const access = await requireBeer(clubId, beerId);
  await rememberActiveClub(access.user, access.club.id);
  return access;
}
