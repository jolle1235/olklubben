"use server";

import { notFound } from "next/navigation";
import { z } from "zod";

import {
  ACTION_ERROR_CODES,
  fail,
  ok,
  rateLimitedError,
  unexpectedError,
  validationError,
  type ActionResult,
  type FieldErrors,
} from "@/lib/action-result";
import { idSchema } from "@/lib/validation/id";
import {
  SONG_PDF_MAX_BYTES,
  SONG_PDF_TOO_LARGE,
  songImportSchema,
} from "@/lib/validation/song-import";
import { songFieldsSchema } from "@/lib/validation/song";
import { requireMembership } from "@/server/auth/session";
import { contentHash } from "@/server/domain/songs/import-hash";
import { canManageSongs, SONGS_FORBIDDEN_MESSAGE } from "@/server/domain/songs/permissions";
import { songTitleKey } from "@/server/domain/songs/title";
import { rateLimit } from "@/server/rate-limit";
import { revalidateClub } from "@/server/revalidate";
import { importSongs, type SongImportSkip } from "@/server/songs/mutations";
import { PdfReadError } from "@/server/songs/pdf-runs";
import { findSongImportMatch } from "@/server/songs/queries";
import { readSongPdf, type SongPdfKind } from "@/server/songs/pdf-import";

/**
 * Import songs from PDFs (SPEC §9.6, D-156), admins only. Two steps, both
 * called from the import page with JavaScript (one PDF per request keeps each
 * request small, and the page shows progress):
 *
 *   1. readSongPdfAction: one PDF → a draft with its status in the club
 *      ("new", "title-taken", "imported"). Nothing is stored, nor the PDF.
 *   2. importSongsAction: the drafts the admin kept (and maybe edited) →
 *      Song rows, re-validated with the song form's schema.
 *
 * Both check membership and canManageSongs on the server (§4.4).
 */

const READ_LIMIT = { limit: 300, windowSeconds: 60 * 60 };
const IMPORT_LIMIT = { limit: 60, windowSeconds: 60 * 60 };

export type SongImportStatus = "new" | "title-taken" | "imported";

/** A draft as the review list shows and edits it ("" = no artist or melody). */
export type SongImportCandidate = {
  kind: SongPdfKind;
  sourceKey: string;
  title: string;
  artist: string;
  melody: string;
  body: string;
  /** contentHash of the fields as read; null when they do not pass the schema. */
  importHash: string | null;
  notes: string[];
  status: SongImportStatus;
  /** The club's song with the same file or title. */
  existing: { id: string; title: string } | null;
  /** The schema's messages for the fields as read (fx a text over 20,000 characters). */
  fieldErrors: FieldErrors | null;
};

async function requireSongAdmin(clubId: unknown) {
  const id = idSchema.safeParse(clubId);
  if (!id.success) notFound();
  const { user, membership, club } = await requireMembership(id.data);
  return { user, club, allowed: canManageSongs(membership) };
}

function isPdf(bytes: Uint8Array): boolean {
  // "%PDF-" within the first KiB, as PDF readers accept.
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
  return head.includes("%PDF-");
}

/** The form field `file`: one non-empty PDF within the size limit. */
async function readUploadedPdf(
  formData: FormData,
): Promise<ActionResult<{ file: File; bytes: Uint8Array }>> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return fail(ACTION_ERROR_CODES.VALIDATION, "Vælg en PDF-fil.");
  }
  if (file.size > SONG_PDF_MAX_BYTES)
    return fail(ACTION_ERROR_CODES.VALIDATION, SONG_PDF_TOO_LARGE);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isPdf(bytes)) return fail(ACTION_ERROR_CODES.VALIDATION, "Filen er ikke en PDF.");
  return ok({ file, bytes });
}

/** Step 1: the form field `file` (one PDF) → its draft. */
export async function readSongPdfAction(
  clubId: string,
  formData: FormData,
): Promise<ActionResult<SongImportCandidate>> {
  const { user, club, allowed } = await requireSongAdmin(clubId);
  if (!allowed) return fail(ACTION_ERROR_CODES.FORBIDDEN, SONGS_FORBIDDEN_MESSAGE);

  const limited = await rateLimit(`song-pdf:read:user:${user.id}`, READ_LIMIT);
  if (!limited.ok) return rateLimitedError(limited.retryAfterSeconds);

  const upload = await readUploadedPdf(formData);
  if (!upload.ok) return upload;
  const { file, bytes } = upload.data;

  let draft;
  try {
    draft = await readSongPdf(file.name, bytes);
  } catch (error) {
    if (error instanceof PdfReadError) return fail(ACTION_ERROR_CODES.VALIDATION, error.message);
    console.error("[songs] readSongPdf failed", error);
    return unexpectedError("PDF'en kunne ikke læses – prøv igen.");
  }

  const fields = songFieldsSchema.safeParse({
    title: draft.title,
    artist: draft.artist ?? "",
    melody: "",
    body: draft.body,
  });
  // The cleaned fields when they pass the schema, else the draft as read.
  const read = fields.success
    ? fields.data
    : { title: draft.title, artist: draft.artist, body: draft.body };
  const match = await findSongImportMatch(club.id, {
    sourceKey: draft.sourceKey,
    titleKey: songTitleKey(read.title),
  });

  return ok({
    kind: draft.kind,
    sourceKey: draft.sourceKey,
    title: read.title,
    artist: read.artist ?? "",
    melody: "",
    body: read.body,
    importHash: fields.success ? contentHash(fields.data) : null,
    notes: draft.notes,
    status: !match ? "new" : match.sameSource ? "imported" : "title-taken",
    existing: match ? { id: match.id, title: match.title } : null,
    fieldErrors: fields.success ? null : validationError(fields.error).error.fieldErrors!,
  });
}

/** Step 2: the songs the admin kept → the songbook. */
export async function importSongsAction(
  clubId: string,
  songs: z.input<typeof songImportSchema>,
): Promise<ActionResult<{ created: number; skipped: SongImportSkip[] }>> {
  const { user, club, allowed } = await requireSongAdmin(clubId);
  const parsed = songImportSchema.safeParse(songs);
  if (!parsed.success) return validationError(parsed.error);
  if (!allowed) return fail(ACTION_ERROR_CODES.FORBIDDEN, SONGS_FORBIDDEN_MESSAGE);

  const limited = await rateLimit(`song-pdf:import:user:${user.id}`, IMPORT_LIMIT);
  if (!limited.ok) return rateLimitedError(limited.retryAfterSeconds);

  let result;
  try {
    result = await importSongs({ clubId: club.id, createdById: user.id, songs: parsed.data });
  } catch (error) {
    console.error("[songs] importSongs failed", error);
    return unexpectedError();
  }
  if (result.created > 0) revalidateClub(club.id);
  return ok(result);
}
