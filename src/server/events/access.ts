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

import { getEvent, type EventDetail } from "./queries";

/**
 * Access to one event for its pages (SPEC §4.4, D-052, TG-008).
 *
 *   requireEvent(clubId, eventId)     membership + the event in THIS club, else
 *                                     notFound(). Never writes, so it is safe in a
 *                                     layout (events/[eventId]/layout.tsx).
 *   requireEventPage(clubId, eventId) the same, then remembers the active club
 *                                     (requireClubPage for event pages).
 *
 * Unknown, malformed and other-club ids all give 404 (E22). The 404 comes
 * before the active club changes, like the [...rest] catch-all. The edit page
 * calls requireEvent, its permission check and then rememberActiveClub, so
 * its permission 404 does not change the active club either. Both are cheap
 * to call twice per request: requireMembership and getEvent are cached.
 */

export type EventAccess = {
  user: SessionUser;
  membership: MembershipInfo;
  club: ClubInfo;
  event: EventDetail;
};

export async function requireEvent(clubId: string, eventId: string): Promise<EventAccess> {
  const access = await requireMembership(clubId);
  if (!isValidId(eventId)) notFound();
  const event = await getEvent(access.club.id, eventId);
  if (!event) notFound();
  return { ...access, event };
}

export async function requireEventPage(clubId: string, eventId: string): Promise<EventAccess> {
  const access = await requireEvent(clubId, eventId);
  await rememberActiveClub(access.user, access.club.id);
  return access;
}
