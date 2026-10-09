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

import { getPlace, type PlaceDetail } from "./queries";

/**
 * Access to one place for its pages (SPEC §4.4, D-065, D-066, D-108), like
 * src/server/events/access.ts:
 *
 *   requirePlace(clubId, placeId)     membership + the place in THIS club, else
 *                                     notFound(). Never writes, so it is safe in
 *                                     the guard layout (places/[placeId]/layout.tsx).
 *   requirePlacePage(clubId, placeId) the same, then remembers the active club.
 *
 * Unknown, malformed and other-club ids all give a real 404 (E22), before the
 * active club changes. The edit page calls requirePlace → canEditPlace →
 * rememberActiveClub (D-089).
 */

export type PlaceAccessResult = {
  user: SessionUser;
  membership: MembershipInfo;
  club: ClubInfo;
  place: PlaceDetail;
};

export async function requirePlace(clubId: string, placeId: string): Promise<PlaceAccessResult> {
  const access = await requireMembership(clubId);
  if (!isValidId(placeId)) notFound();
  const place = await getPlace(access.club.id, placeId);
  if (!place) notFound();
  return { ...access, place };
}

export async function requirePlacePage(
  clubId: string,
  placeId: string,
): Promise<PlaceAccessResult> {
  const access = await requirePlace(clubId, placeId);
  await rememberActiveClub(access.user, access.club.id);
  return access;
}
