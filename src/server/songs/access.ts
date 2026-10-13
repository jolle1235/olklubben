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

import { getSong, type SongDetail } from "./queries";

/**
 * Access to one song for its pages (SPEC §4.4, §9.6, D-065, D-066), like
 * src/server/places/access.ts:
 *
 *   requireSong(clubId, songId)     membership + the song in THIS club, else
 *                                   notFound(). Never writes, so it is safe in
 *                                   the guard layout (songs/[songId]/layout.tsx).
 *   requireSongPage(clubId, songId) the same, then remembers the active club.
 *
 * Unknown, malformed and other-club ids all give a real 404 (E22), before the
 * active club changes. The edit page calls requireSong → canManageSongs →
 * rememberActiveClub (D-089).
 */

export type SongAccessResult = {
  user: SessionUser;
  membership: MembershipInfo;
  club: ClubInfo;
  song: SongDetail;
};

export async function requireSong(clubId: string, songId: string): Promise<SongAccessResult> {
  const access = await requireMembership(clubId);
  if (!isValidId(songId)) notFound();
  const song = await getSong(access.club.id, songId);
  if (!song) notFound();
  return { ...access, song };
}

export async function requireSongPage(clubId: string, songId: string): Promise<SongAccessResult> {
  const access = await requireSong(clubId, songId);
  await rememberActiveClub(access.user, access.club.id);
  return access;
}
