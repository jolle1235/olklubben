import { normalizeChordGlyphs } from "../../src/server/domain/songs/chords";
import { lineKind, sectionLabel } from "../../src/server/domain/songs/song-text";

import { cleanRunText } from "./clean";
import type { PdfRun } from "./pdf-xml";
import {
  alignChords,
  chordTokens,
  LEFT_MARGIN,
  PITCH,
  rowRaw,
  rowRight,
  runsToRows,
  withRoles,
  WRAP_RIGHT_EDGE,
  type Row,
} from "./rows";
import { addChordRowBreaks, addChorusBreaks, tidyBlocks } from "./stanzas";

/**
 * One ChordBank printout (title, artist, chord-diagram row, then chord rows,
 * section labels and lyrics) → the song's lines with their FONT-TRUTH kind.
 * A port of the prototype's extract.py:
 *
 *   * the empty lyric row ChordBank prints under every chord-only row is dropped;
 *   * a vertical gap above PITCH + 10 px is a stanza break; a page break is a
 *     continuation;
 *   * a full-width row continued by a row in lower case is one line (soft wrap);
 *   * positioned chords (first chord right of the margin, or wide gaps) are
 *     aligned to the columns of the lyric row below;
 *   * font-versus-text fixes: a lyric-font line the app reads as chords is a
 *     chord line, a lyric-font section word is a label, and a label typed
 *     under a chord row moves above it;
 *   * the two stanza heuristics (stanzas.ts).
 */

export type BlockKind = "blank" | "section" | "note" | "chord" | "lyric";

export type Block = {
  kind: BlockKind;
  /** The stored line, except for a section (stored as "[label]"). */
  text: string;
  /** The Danish label of a section. */
  label?: string;
  /** A chord row aligned over the lyric below. */
  positioned?: boolean;
  /** A chord row followed by ChordBank's empty spacer row (a chord-only row). */
  spacer?: boolean;
  /** Why a blank was added: "gap", "empty-row", "chord-row", "chorus". */
  src?: string;
};

export type ChordBankStats = {
  chordSpacers: number;
  gapBlanks: number;
  pageBreaks: number;
  softWrapsJoined: number;
  positionedChordRows: number;
  stanzaBreaksInserted: number;
  chorusBreaksInserted: number;
  relabelledSections: number;
  chordsInLyricFont: number;
  titleRows: number;
  headerRows: number;
};

export type ChordBankSong = {
  heading: string;
  artist: string | null;
  headerChords: string[];
  blocks: Block[];
  stats: ChordBankStats;
  pages: number;
  /** "Family size" of every run with a font ChordBank does not use (→ FEJL). */
  unknownFonts: string[];
};

function startsLowerCase(text: string): boolean {
  const first = text.charAt(0);
  return first !== "" && first === first.toLowerCase() && first !== first.toUpperCase();
}

/** "[Vers 2]" / "Chorus" as a Danish label (section-font rows). */
function labelOf(text: string): string {
  const inner = text.replace(/^\[+|\]+$/g, "");
  return sectionLabel(`[${inner}]`) ?? text;
}

export function extractChordBankSong(pdfRuns: readonly PdfRun[]): ChordBankSong {
  const { runs, unknownFonts } = withRoles(pdfRuns);
  const rows = runsToRows(runs);
  const stats: ChordBankStats = {
    chordSpacers: 0,
    gapBlanks: 0,
    pageBreaks: 0,
    softWrapsJoined: 0,
    positionedChordRows: 0,
    stanzaBreaksInserted: 0,
    chorusBreaksInserted: 0,
    relabelledSections: 0,
    chordsInLyricFont: 0,
    titleRows: 0,
    headerRows: 0,
  };

  const titleRows = rows.filter((r) => r.role === "title");
  const artistRows = rows.filter((r) => r.role === "artist");
  const diagramRows = rows.filter((r) => r.role === "diagram");
  const body = rows.filter((r) => r.role === "chord" || r.role === "lyric" || r.role === "label");
  stats.titleRows = titleRows.length;
  stats.headerRows = diagramRows.length;

  const heading = cleanRunText(titleRows.map(rowRaw).join(" "));
  const artist = cleanRunText(artistRows.map(rowRaw).join(" ")) || null;
  const headerChords = diagramRows.flatMap((r) => chordTokens(r.runs).map((t) => t.chord));

  const blocks: Block[] = [];
  let prev: Row | null = null;
  const n = body.length;
  let i = 0;
  while (i < n) {
    let row = body[i] as Row;
    if (prev !== null) {
      if (row.page !== prev.page) stats.pageBreaks += 1;
      else if (row.top - prev.top > PITCH + 10) {
        blocks.push({ kind: "blank", text: "", src: "gap" });
        stats.gapBlanks += 1;
      }
    }

    if (row.role === "chord") {
      const tokens = chordTokens(row.runs);
      let j = i + 1;
      const next = body[j];
      const spacer =
        next !== undefined && next.role === "lyric" && cleanRunText(rowRaw(next)) === "";
      if (spacer) {
        stats.chordSpacers += 1;
        j += 1;
      }
      const after = body[j];
      const target =
        after !== undefined && after.role === "lyric" && cleanRunText(rowRaw(after)) !== ""
          ? after
          : null;
      const first = tokens[0];
      const wideGap = tokens.some((t, k) => k > 0 && t.x - (tokens[k - 1]?.x ?? t.x) > 45);
      const positioned = first !== undefined && (first.x > LEFT_MARGIN + 4 || wideGap);
      let text: string;
      if (positioned && target !== null) {
        text = alignChords(tokens, target);
        stats.positionedChordRows += 1;
      } else {
        text = tokens.map((t) => t.chord).join(" ");
      }
      blocks.push({ kind: "chord", text, positioned: positioned && target !== null, spacer });
      prev = spacer ? (body[j - 1] as Row) : row;
      i = j;
      continue;
    }

    let text = cleanRunText(rowRaw(row));
    if (row.role === "label") {
      blocks.push({ kind: "section", text, label: labelOf(text) });
    } else if (text === "") {
      blocks.push({ kind: "blank", text: "", src: "empty-row" });
    } else {
      // ChordBank soft wrap: a full-width row continued by a lower-case row.
      for (;;) {
        const following = body[i + 1];
        if (
          rowRight(row) < WRAP_RIGHT_EDGE ||
          following === undefined ||
          following.role !== "lyric" ||
          following.page !== row.page ||
          following.top - row.top > PITCH + 2 ||
          !startsLowerCase(cleanRunText(rowRaw(following)))
        ) {
          break;
        }
        i += 1;
        text = `${text} ${cleanRunText(rowRaw(following))}`;
        row = following;
        stats.softWrapsJoined += 1;
      }
      const label = sectionLabel(text);
      const kind = label === null ? lineKind(text) : "section";
      if (label !== null) {
        stats.relabelledSections += 1;
        blocks.push({ kind: "section", text, label });
      } else if (kind === "note") {
        blocks.push({ kind: "note", text });
      } else if (kind === "chords") {
        // Chords typed into the lyric field.
        stats.chordsInLyricFont += 1;
        blocks.push({ kind: "chord", text: normalizeChordGlyphs(text) });
      } else {
        blocks.push({ kind: "lyric", text });
      }
    }
    prev = row;
    i += 1;
  }

  const tidy = tidyBlocks(blocks);
  const withChordRowBreaks = addChordRowBreaks(tidy);
  stats.stanzaBreaksInserted = withChordRowBreaks.added;
  const withChorusBreaks = addChorusBreaks(withChordRowBreaks.blocks);
  stats.chorusBreaksInserted = withChorusBreaks.added;

  return {
    heading,
    artist,
    headerChords,
    blocks: withChorusBreaks.blocks,
    stats,
    pages: pdfRuns.reduce((max, run) => Math.max(max, run.page), 0),
    unknownFonts,
  };
}
