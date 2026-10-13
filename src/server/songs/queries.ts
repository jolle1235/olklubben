import "server-only";

import { cache } from "react";

import { isValidId } from "@/lib/ids";
import { db } from "@/server/db";
import { lyricsOnlyLines } from "@/server/domain/songs/song-text";
import { songIndexLetter, sortSongs, type SongbookLetter } from "@/server/domain/songs/title";
import { personSelect, type PersonRef } from "@/server/users/select";

/**
 * Read queries for the songbook (SPEC §9.6).
 *
 * Club isolation (§4.4): every query takes the clubId and filters by it, so a
 * song of another club is simply "not found". The caller must already have
 * checked membership (requireClubPage / requireSong).
 *
 * Only the SERVER sorts (compareSongTitles, Danish order) and computes the
 * letter headings, so Node and browser ICU never disagree. `body` is never
 * sent raw to search: the list carries lyricsOnlyLines(body), so chord lines
 * ("Am") and section labels never match a query.
 */

/** One song of the list page, in book order. The array index is the canonical order. */
export type SongbookEntry = {
  id: string;
  title: string;
  artist: string | null;
  melody: string | null;
  /** The letter heading the song files under (songIndexLetter, "#" for numbers). */
  letter: SongbookLetter;
  /** lyricsOnlyLines(body): what the search matches and the snippet shows. */
  lines: string[];
};

/** One song for the reader and the edit form. */
export type SongDetail = {
  id: string;
  title: string;
  artist: string | null;
  melody: string | null;
  /** The song-text format (song-text.ts). Render with parseSong(), never raw. */
  body: string;
  createdBy: PersonRef;
  createdAt: Date;
  updatedAt: Date;
};

/** A song's id and title (Forrige/Næste sang). */
export type SongTitleRef = { id: string; title: string };

/**
 * Every song of the club in Danish book order, with its letter and lyric lines
 * (SongbookBrowser searches them on the client). About 90 kB JSON for 60 songs.
 */
export async function listSongbook(clubId: string): Promise<SongbookEntry[]> {
  const rows = await db.song.findMany({
    where: { clubId },
    select: { id: true, title: true, artist: true, melody: true, body: true },
  });
  return sortSongs(rows).map((row) => ({
    id: row.id,
    title: row.title,
    artist: row.artist,
    melody: row.melody,
    letter: songIndexLetter(row.title),
    lines: lyricsOnlyLines(row.body),
  }));
}

/**
 * One song of the club, or null (unknown id, malformed id or another club's
 * song). Cached per request, so the guard layout, generateMetadata and the
 * page share one query.
 */
export const getSong = cache(async (clubId: string, songId: string): Promise<SongDetail | null> => {
  if (!isValidId(songId)) return null;
  return db.song.findFirst({
    where: { id: songId, clubId },
    select: {
      id: true,
      title: true,
      artist: true,
      melody: true,
      body: true,
      createdBy: { select: personSelect },
      createdAt: true,
      updatedAt: true,
    },
  });
});

/** The club's song titles in book order (songNeighbours: Forrige/Næste through the whole book). */
export const listSongTitles = cache(async (clubId: string): Promise<SongTitleRef[]> => {
  const rows = await db.song.findMany({ where: { clubId }, select: { id: true, title: true } });
  return sortSongs(rows);
});
