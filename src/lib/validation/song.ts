import { z } from "zod";

import { cleanSongText, SONG_BODY_MAX_LENGTH } from "@/server/domain/songs/song-text";
import {
  cleanSongTitle,
  SONG_ARTIST_MAX_LENGTH,
  SONG_MELODY_MAX_LENGTH,
  SONG_TITLE_MAX_LENGTH,
} from "@/server/domain/songs/title";

import { idSchema } from "./id";
import { optionalText, rawTextLimit } from "./text";

/**
 * Zod schemas for the songbook (SPEC §9.6), shared by the song form (client),
 * the Server Actions and the importer (scripts/songbook/**). Messages are
 * Danish.
 *
 *   * title: cleaned (cleanSongTitle: NUL removed, NFC, whitespace
 *     collapsed), 1–120 characters. Whether another song of the club has the
 *     same title key is decided in the data layer (SongTitleTakenError →
 *     fieldErrors.title).
 *   * artist, melody: optional, ≤ 120, single line.
 *   * body: the song-text format, cleaned with cleanSongText (NOT
 *     cleanSingleLine: leading and inner spaces carry chord columns), 1–20,000
 *     characters with at least one non-blank line. The raw text is capped
 *     BEFORE it is cleaned (D-090).
 *
 * Client-safe: the domain modules are pure.
 */

const TITLE_REQUIRED = "Giv sangen en titel.";
const TITLE_TOO_LONG = `Titlen må højst være ${SONG_TITLE_MAX_LENGTH} tegn.`;
/** A raw title longer than this is refused before it is cleaned (D-090). */
const TITLE_RAW_MAX_LENGTH = 2000;

const BODY_REQUIRED = "Skriv sangens tekst.";
const BODY_TOO_LONG = `Teksten må højst være ${new Intl.NumberFormat("da-DK").format(SONG_BODY_MAX_LENGTH)} tegn.`;

export const songFieldsSchema = z.object({
  title: z
    .string({ error: TITLE_REQUIRED })
    .max(TITLE_RAW_MAX_LENGTH, TITLE_TOO_LONG)
    .transform(cleanSongTitle)
    .pipe(z.string().min(1, TITLE_REQUIRED).max(SONG_TITLE_MAX_LENGTH, TITLE_TOO_LONG)),
  artist: optionalText(
    SONG_ARTIST_MAX_LENGTH,
    `Kunstneren må højst være ${SONG_ARTIST_MAX_LENGTH} tegn.`,
  ),
  melody: optionalText(
    SONG_MELODY_MAX_LENGTH,
    `Melodien må højst være ${SONG_MELODY_MAX_LENGTH} tegn.`,
  ),
  body: z
    .string({ error: BODY_REQUIRED })
    .max(rawTextLimit(SONG_BODY_MAX_LENGTH), BODY_TOO_LONG)
    .transform(cleanSongText)
    // cleanSongText drops blank lines at the ends, so "" = nothing but blank lines.
    .pipe(z.string().min(1, BODY_REQUIRED).max(SONG_BODY_MAX_LENGTH, BODY_TOO_LONG)),
});

/** The song form (create and edit): the fields plus the hidden clubId. */
export const songFormSchema = songFieldsSchema.extend({ clubId: idSchema });

/** Which song a Server Action is about. A failed parse → notFound() (§4.4, E22). */
export const songRefSchema = z.object({ clubId: idSchema, songId: idSchema });

export type SongFieldsInput = z.input<typeof songFieldsSchema>;
export type SongFieldsData = z.output<typeof songFieldsSchema>;
