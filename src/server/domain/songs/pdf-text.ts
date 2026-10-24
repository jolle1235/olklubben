import type { PdfRun } from "./chordbank/pdf-run";
import { cleanRunText } from "./chordbank/clean";
import { isChordLine } from "./chords";

/**
 * Any PDF that is not a ChordBank printout → the song's lines (SPEC §9.6,
 * D-156). Best effort; the admin checks the result before it is imported:
 *
 *   * runs on the same page whose tops are within half a font size form one
 *     line, read left to right (a gap of ≥ 2 px is a space);
 *   * a vertical gap above 1.6 × the usual line pitch is a new stanza; a page
 *     break is a continuation;
 *   * a chord line keeps its columns over the line below it (chord x → the
 *     character under it, as in the ChordBank parser); like typed text, every
 *     line is classified only when shown (song-text.ts);
 *   * the first line is the heading when its font is clearly larger than the
 *     body's (a title), and lines that are only a page number are dropped.
 *
 * Pure: no pdf.js here (src/server/songs/pdf-runs.ts reads the runs).
 */

type Line = { page: number; top: number; size: number; runs: PdfRun[] };

export type PdfTextSong = {
  /** The first line when it is set in a larger font, else null. */
  heading: string | null;
  lines: string[];
};

const STANZA_GAP_FACTOR = 1.6;
const HEADING_SIZE_FACTOR = 1.2;
const PAGE_NUMBER_RE = /^(?:side\s*)?\d{1,3}(?:\s*(?:\/|af)\s*\d{1,3})?$/i;

/** The lower median: with few lines, the stanza gaps never become the "usual" pitch. */
function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)] ?? 0;
}

function toLines(runs: readonly PdfRun[]): Line[] {
  const sorted = runs
    .filter((run) => run.text.trim() !== "")
    .sort((a, b) => a.page - b.page || a.top - b.top || a.left - b.left);
  const lines: Line[] = [];
  for (const run of sorted) {
    const last = lines[lines.length - 1];
    if (
      last &&
      last.page === run.page &&
      Math.abs(last.top - run.top) <= Math.max(last.size, run.size) / 2
    ) {
      last.runs.push(run);
      last.size = Math.max(last.size, run.size);
    } else {
      lines.push({ page: run.page, top: run.top, size: run.size, runs: [run] });
    }
  }
  for (const line of lines) line.runs.sort((a, b) => a.left - b.left);
  return lines;
}

function lineLeft(line: Line): number {
  return line.runs[0]?.left ?? 0;
}

/** The runs joined with single spaces where there is a gap. */
function plainText(line: Line): string {
  let out = "";
  let end: number | null = null;
  for (const run of line.runs) {
    const text = cleanRunText(run.text);
    if (text === "") continue;
    if (end !== null && run.left - end >= 2 && !out.endsWith(" ")) out += " ";
    out += text;
    end = run.left + run.width;
  }
  return out.trim();
}

/** A chord line with each chord over the character of `below` at its x. */
function alignedChords(chords: Line, below: Line): string {
  const text = plainText(below);
  const left = lineLeft(below);
  const right = Math.max(...below.runs.map((r) => r.left + r.width));
  const perChar = (right - left) / Math.max(text.length, 1);
  let out = "";
  for (const run of chords.runs) {
    for (const match of run.text.matchAll(/\S+/g)) {
      const x = run.left + (match.index / Math.max(run.text.length, 1)) * run.width;
      let col = Math.max(0, Math.round((x - left) / perChar));
      if (out.length > 0 && col <= out.length) col = out.length + 1;
      out = out.padEnd(col) + cleanRunText(match[0]);
    }
  }
  return out;
}

export function pdfTextSong(runs: readonly PdfRun[]): PdfTextSong {
  const lines = toLines(runs).filter((line) => !PAGE_NUMBER_RE.test(plainText(line)));
  if (lines.length === 0) return { heading: null, lines: [] };

  const bodySize = median(lines.map((l) => l.size));
  let heading: string | null = null;
  const first = lines[0];
  if (first && lines.length > 1 && first.size >= bodySize * HEADING_SIZE_FACTOR) {
    heading = plainText(first);
    lines.shift();
  }

  const pitches: number[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const [a, b] = [lines[i - 1]!, lines[i]!];
    if (a.page === b.page) pitches.push(b.top - a.top);
  }
  const pitch = median(pitches) || bodySize;

  const out: string[] = [];
  lines.forEach((line, i) => {
    const previous = lines[i - 1];
    if (
      previous &&
      previous.page === line.page &&
      line.top - previous.top > pitch * STANZA_GAP_FACTOR
    ) {
      out.push("");
    }
    const text = plainText(line);
    const next = lines[i + 1];
    const nextIsLyric =
      next !== undefined &&
      next.page === line.page &&
      next.top - line.top <= pitch * STANZA_GAP_FACTOR &&
      !isChordLine(plainText(next));
    out.push(isChordLine(text) && nextIsLyric ? alignedChords(line, next) : text);
  });
  return { heading, lines: out };
}
