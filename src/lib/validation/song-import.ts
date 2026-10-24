import { z } from "zod";

import { SOURCE_KEY_MAX_LENGTH } from "@/server/domain/songs/chordbank/source-key";

import { songFieldsSchema } from "./song";

/**
 * The PDF import's "Importér" (SPEC §9.6, D-156): the songs the admin kept,
 * each with the song form's fields and its provenance. Client-safe.
 *
 *   * sourceKey: "chordbank:<file>" or "pdf:<file>", ≤ 300 characters.
 *   * importHash: the hash the server gave the draft as read, or null. When
 *     the admin edited the draft, the stored song no longer hashes to it, so
 *     a later re-import treats it as edited in the app and leaves it alone.
 *   * At most 25 songs per request; the page sends larger imports in batches.
 */

export const SONG_IMPORT_BATCH_SIZE = 25;

/** One PDF per request; Vercel refuses request bodies over 4.5 MB. */
export const SONG_PDF_MAX_BYTES = 4 * 1024 * 1024;
export const SONG_PDF_TOO_LARGE = `PDF'en er for stor (højst ${SONG_PDF_MAX_BYTES / 1024 / 1024} MB).`;

const songImportItemSchema = songFieldsSchema.extend({
  sourceKey: z
    .string()
    .max(SOURCE_KEY_MAX_LENGTH)
    .regex(/^(?:chordbank|pdf):\S/),
  importHash: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .nullable(),
});

export const songImportSchema = z
  .array(songImportItemSchema)
  .min(1, "Vælg mindst én sang.")
  .max(SONG_IMPORT_BATCH_SIZE);
