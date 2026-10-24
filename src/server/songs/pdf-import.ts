import "server-only";

import { extractChordBankSong } from "@/server/domain/songs/chordbank/chordbank";
import { chordBankDraft } from "@/server/domain/songs/chordbank/draft";
import { withRoles } from "@/server/domain/songs/chordbank/rows";
import { SOURCE_KEY_MAX_LENGTH, sourceKeyOf } from "@/server/domain/songs/chordbank/source-key";
import { chooseSongTitle, fileTitle } from "@/server/domain/songs/chordbank/title";
import { pdfTextSong } from "@/server/domain/songs/pdf-text";
import { cleanSongText, lyricsOnlyLines } from "@/server/domain/songs/song-text";

import { readPdfRuns } from "./pdf-runs";

/**
 * One uploaded PDF → a song draft for the import review (SPEC §9.6, D-156).
 *
 *   * A ChordBank printout (only ChordBank's fonts, and a title) is parsed
 *     exactly like the CLI import (scripts/import-songbook.ts): chords over
 *     the words, labels, stanzas, the same title rule, and the same
 *     sourceKey "chordbank:<file>", so the two imports recognise each other.
 *   * Any other PDF becomes plain text (pdf-text.ts) with sourceKey
 *     "pdf:<file>", and a note that the admin should check it.
 *
 * Nothing is stored here, and the PDF itself is never kept (D-120). Throws
 * PdfReadError for a file that is not a readable PDF.
 */

export type SongPdfKind = "chordbank" | "text";

export type SongPdfDraft = {
  kind: SongPdfKind;
  sourceKey: string;
  title: string;
  artist: string | null;
  body: string;
  /** Things the admin should know before importing, in Danish. */
  notes: string[];
};

/** The page limit for one song's PDF. */
const MAX_PAGES = 30;

/** "Øl og sang.PDF" → "Øl og sang". */
function fileStem(fileName: string): string {
  return fileName.normalize("NFC").replace(/\.pdf$/i, "");
}

/** The shared sourceKeyOf (the CLI's key), cut to the column's limit. */
function sourceKey(kind: SongPdfKind, fileName: string): string {
  return sourceKeyOf(fileName, kind).slice(0, SOURCE_KEY_MAX_LENGTH);
}

const HAS_LOWER_RE = /\p{Ll}/u;

export async function readSongPdf(fileName: string, data: Uint8Array): Promise<SongPdfDraft> {
  const runs = await readPdfRuns(data, { maxPages: MAX_PAGES });
  const stem = fileStem(fileName);

  // Only ChordBank's fonts: parse it as the CLI does. Anything else skips that parse.
  const chordBank = withRoles(runs).unknownFonts.length === 0 ? extractChordBankSong(runs) : null;
  if (chordBank && chordBank.heading !== "") {
    const draft = chordBankDraft(chordBank, stem);
    const n = draft.roundTrip.disagreements.length;
    return {
      kind: "chordbank",
      sourceKey: sourceKey("chordbank", fileName),
      title: draft.chosen.title,
      artist: chordBank.artist,
      body: cleanSongText(draft.joined),
      notes:
        n > 0
          ? [`${n === 1 ? "1 linje" : `${n} linjer`} vises anderledes end i PDF'en. Tjek teksten.`]
          : [],
    };
  }

  const text = pdfTextSong(runs);
  const body = cleanSongText(text.lines.join("\n"));
  const lyrics = lyricsOnlyLines(body);
  let title = fileTitle(stem);
  if (text.heading) {
    // An ALL-CAPS heading gets the CLI's casing rule; any other is kept as written.
    title = HAS_LOWER_RE.test(text.heading)
      ? text.heading
      : chooseSongTitle(text.heading, stem, lyrics).title;
  }
  return {
    kind: "text",
    sourceKey: sourceKey("text", fileName),
    title,
    artist: null,
    body,
    notes:
      body === ""
        ? ["PDF'en har ingen tekst, som kan læses. Er den scannet? Så må sangen skrives ind."]
        : ["Læst som ren tekst. Tjek vers og akkorder, før du importerer."],
  };
}
