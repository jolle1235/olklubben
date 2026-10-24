import "server-only";

import { isUniqueConstraintError } from "@/server/clubs/unique-retry";
import { db } from "@/server/db";
import { contentHash } from "@/server/domain/songs/import-hash";
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
 * The form's writes never set source_key, so that unique index cannot fire there.
 *
 * Editing a song NEVER touches sourceKey or importHash: that is how a
 * re-import (the PDF import below, scripts/import-songbook.ts) sees that an
 * admin has edited an imported song. Only importSongs sets them.
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

/** One song of a PDF import (SPEC §9.6, D-156): the fields plus its provenance. */
export type SongImportData = SongWriteData & { sourceKey: string; importHash: string | null };

export type SongImportSkip = { title: string; reason: "imported" | "title-taken" | "duplicate" };

/**
 * "Importér" on the PDF import page: adds the songs that fit, in one
 * statement, and says why the others were skipped. A song is skipped when the
 * club already has its source file (imported before), another song has its
 * title, or an earlier song of the same batch has the title or file. Never
 * updates or deletes anything. A song created by someone else meanwhile is
 * skipped by the database (ON CONFLICT DO NOTHING) and counted as taken.
 *
 * sourceKey and importHash are set together (songs_import_pair_check): a
 * draft whose fields did not pass the schema as read has no hash, so it gets
 * the hash of what is stored.
 */
export async function importSongs(input: {
  clubId: string;
  createdById: string;
  songs: readonly SongImportData[];
}): Promise<{ created: number; skipped: SongImportSkip[] }> {
  const { clubId, createdById, songs } = input;
  const existing = await db.song.findMany({
    where: {
      clubId,
      OR: [
        { titleKey: { in: songs.map((s) => songTitleKey(s.title)) } },
        { sourceKey: { in: songs.map((s) => s.sourceKey) } },
      ],
    },
    select: { titleKey: true, sourceKey: true },
  });
  const takenTitles = new Set(existing.map((e) => e.titleKey));
  const importedSources = new Set(existing.flatMap((e) => (e.sourceKey ? [e.sourceKey] : [])));

  const skipped: SongImportSkip[] = [];
  const batchTitles = new Set<string>();
  const batchSources = new Set<string>();
  const rows = [];
  for (const song of songs) {
    const titleKey = songTitleKey(song.title);
    const reason = importedSources.has(song.sourceKey)
      ? "imported"
      : takenTitles.has(titleKey)
        ? "title-taken"
        : batchTitles.has(titleKey) || batchSources.has(song.sourceKey)
          ? "duplicate"
          : null;
    if (reason) {
      skipped.push({ title: song.title, reason });
      continue;
    }
    batchTitles.add(titleKey);
    batchSources.add(song.sourceKey);
    rows.push({
      clubId,
      createdById,
      titleKey,
      ...song,
      importHash: song.importHash ?? contentHash(song),
    });
  }

  if (rows.length === 0) return { created: 0, skipped };
  const { count } = await db.song.createMany({ data: rows, skipDuplicates: true });
  if (count < rows.length) {
    // Taken meanwhile: report the rows that did not land.
    const landed = await db.song.findMany({
      where: { clubId, sourceKey: { in: rows.map((r) => r.sourceKey) }, createdById },
      select: { sourceKey: true },
    });
    const landedSources = new Set(landed.map((l) => l.sourceKey));
    for (const row of rows) {
      if (!landedSources.has(row.sourceKey))
        skipped.push({ title: row.title, reason: "title-taken" });
    }
  }
  return { created: count, skipped };
}
