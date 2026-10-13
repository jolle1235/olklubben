import "server-only";

import { isUniqueConstraintError } from "@/server/clubs/unique-retry";
import { db } from "@/server/db";
import { songTitleKey } from "@/server/domain/songs/title";

/**
 * Writes for the songbook (SPEC §9.6, §5.1: admins only).
 *
 * Authorization is the caller's job (the Server Actions: membership and
 * canManageSongs). Every write is scoped by clubId (§4.4), so a song of
 * another club is never touched – the result says "not found".
 *
 * Title uniqueness: one song per title key and club (songs_club_id_title_key_key).
 * Each write is a single statement, so a P2002 is safe to catch; it then looks
 * up the song that has the title (SongTitleTakenError → the title field).
 * App writes never set source_key, so that unique index cannot fire here.
 *
 * App writes NEVER touch sourceKey or importHash: that is how the importer
 * (scripts/import-songbook.ts) sees that an admin has edited an imported song.
 *
 * Inputs are already cleaned by the Zod schemas (src/lib/validation/song.ts).
 */

export class SongTitleTakenError extends Error {
  readonly code = "SONG_TITLE_TAKEN";

  constructor(readonly existing: { id: string; title: string }) {
    super(`Der findes allerede en sang, der hedder «${existing.title}».`);
    this.name = "SongTitleTakenError";
  }
}

/** What the song form stores (songFieldsSchema's output). */
export type SongWriteData = {
  title: string;
  artist: string | null;
  melody: string | null;
  body: string;
};

/** After a P2002: the club's other song with the same title key, else rethrow. */
async function titleTaken(
  error: unknown,
  clubId: string,
  title: string,
  excludeId?: string,
): Promise<never> {
  if (isUniqueConstraintError(error)) {
    const existing = await db.song.findFirst({
      where: {
        clubId,
        titleKey: songTitleKey(title),
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, title: true },
    });
    if (existing) throw new SongTitleTakenError(existing);
  }
  throw error;
}

/** Adds a song to the club. Throws SongTitleTakenError when the title is taken. */
export async function createSong(
  input: { clubId: string; createdById: string } & SongWriteData,
): Promise<{ id: string }> {
  const { clubId, createdById, title, artist, melody, body } = input;
  try {
    return await db.song.create({
      data: { clubId, createdById, title, titleKey: songTitleKey(title), artist, melody, body },
      select: { id: true },
    });
  } catch (error) {
    return titleTaken(error, clubId, title);
  }
}

/**
 * Updates the song if it is in the club; false when it is not (→ 404).
 * Throws SongTitleTakenError when another song has the new title.
 */
export async function updateSong(
  input: { clubId: string; songId: string } & SongWriteData,
): Promise<boolean> {
  const { clubId, songId, title, artist, melody, body } = input;
  try {
    const { count } = await db.song.updateMany({
      where: { id: songId, clubId },
      data: { title, titleKey: songTitleKey(title), artist, melody, body },
    });
    return count === 1;
  } catch (error) {
    return titleTaken(error, clubId, title, songId);
  }
}

/** Deletes the song if it is in the club; false when it is not (→ 404). */
export async function deleteSong(input: { clubId: string; songId: string }): Promise<boolean> {
  const { count } = await db.song.deleteMany({ where: { id: input.songId, clubId: input.clubId } });
  return count === 1;
}
