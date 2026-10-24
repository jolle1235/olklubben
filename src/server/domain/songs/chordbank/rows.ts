import { normalizeChordGlyphs } from "@/server/domain/songs/chords";

import { cleanRunText } from "./clean";
import type { PdfRun } from "./pdf-run";

/**
 * ChordBank layout: font roles, visual rows, chord tokens with their x, and
 * the alignment of positioned chords to the lyric row below. A port of the
 * prototype's extract.py (the reference), rule for rule.
 */

/** Every body row starts here unless its chords are positioned. */
export const LEFT_MARGIN = 138;
/** Normal row pitch in px (pdftohtml -xml uses 1.5 × PDF points). */
export const PITCH = 21;
/** ChordBank soft-wraps rows that reach about 627 px. */
export const WRAP_RIGHT_EDGE = 615;

export type Role = "title" | "artist" | "diagram" | "chord" | "label" | "lyric";

const FONT_ROLES: { family: RegExp; size: number; role: Role }[] = [
  { family: /^OpenSans-ExtraBold$/, size: 25, role: "title" },
  { family: /^OpenSans(?:-Italic)?$/, size: 20, role: "artist" },
  { family: /^CBSans$/, size: 8, role: "diagram" },
  { family: /^CBSans$/, size: 14, role: "chord" },
  { family: /^CBSans$/, size: 16, role: "label" },
  { family: /^CBSerif$/, size: 16, role: "lyric" },
  // Only the ′ glyph ChordBank falls back to inside lyric rows.
  { family: /^Helvetica$/, size: 16, role: "lyric" },
];

/** The role of a font (size ±1), or null for a font ChordBank does not use: never a guess. */
export function fontRole(family: string, size: number): Role | null {
  const match = FONT_ROLES.find((f) => f.family.test(family) && Math.abs(f.size - size) <= 1);
  return match?.role ?? null;
}

export type Run = {
  page: number;
  top: number;
  left: number;
  width: number;
  role: Role;
  text: string;
};

export type Row = { page: number; top: number; role: Role; runs: Run[] };

export function rowLeft(row: Row): number {
  return Math.min(...row.runs.map((r) => r.left));
}

export function rowRight(row: Row): number {
  return Math.max(...row.runs.map((r) => r.left + r.width));
}

/** The runs of one row joined left to right; a gap of ≥ 2 px becomes one space. */
export function joinRuns(runs: readonly Run[], spaceGap = 2): string {
  let out = "";
  let prevEnd: number | null = null;
  for (const run of [...runs].sort((a, b) => a.left - b.left)) {
    if (prevEnd !== null && run.left - prevEnd >= spaceGap) {
      if (!out.endsWith(" ") && !run.text.startsWith(" ")) out += " ";
    }
    out += run.text;
    prevEnd = run.left + run.width;
  }
  return out;
}

export function rowRaw(row: Row): string {
  return joinRuns(row.runs);
}

/** Runs with their role; null when a run uses an unknown font. */
export function withRoles(runs: readonly PdfRun[]): { runs: Run[]; unknownFonts: string[] } {
  const out: Run[] = [];
  const unknown = new Set<string>();
  for (const run of runs) {
    const role = fontRole(run.family, run.size);
    if (role === null) unknown.add(`${run.family} ${run.size}`);
    else
      out.push({
        page: run.page,
        top: run.top,
        left: run.left,
        width: run.width,
        role,
        text: run.text,
      });
  }
  return { runs: out, unknownFonts: [...unknown].sort() };
}

/** Visual rows: same page and role, top within 4 px. The ′ runs join their lyric row. */
export function runsToRows(runs: readonly Run[]): Row[] {
  const sorted = [...runs].sort((a, b) => a.page - b.page || a.top - b.top || a.left - b.left);
  const rows: Row[] = [];
  for (const run of sorted) {
    const last = rows[rows.length - 1];
    if (
      last &&
      last.page === run.page &&
      Math.abs(last.top - run.top) <= 4 &&
      last.role === run.role
    ) {
      last.runs.push(run);
    } else {
      rows.push({ page: run.page, top: run.top, role: run.role, runs: [run] });
    }
  }
  return rows;
}

/**
 * (x, chord) per chord of a chord row. Glyph runs (♭ ♯ ᶆ ⁷) glue onto the run
 * before them; a run with inner spaces ("F B") is split, and the x of the
 * later tokens is estimated proportionally. Glyphs normalised.
 */
export function chordTokens(runs: readonly Run[]): { x: number; chord: string }[] {
  const tokens: { x: number; text: string; end: number }[] = [];
  for (const run of [...runs].sort((a, b) => a.left - b.left)) {
    const last = tokens[tokens.length - 1];
    if (last && run.left - last.end < 2 && !run.text.startsWith(" ") && !last.text.endsWith(" ")) {
      last.text += run.text;
      last.end = run.left + run.width;
    } else {
      tokens.push({ x: run.left, text: run.text, end: run.left + run.width });
    }
  }
  const out: { x: number; chord: string }[] = [];
  for (const { x, text, end } of tokens) {
    const parts = text.split(/\s+/).filter((p) => p !== "");
    if (parts.length <= 1) {
      if (parts[0] !== undefined) out.push({ x, chord: parts[0] });
      continue;
    }
    const perChar = (end - x) / Math.max(text.length, 1);
    let pos = 0;
    for (const part of parts) {
      const i = text.indexOf(part, pos);
      out.push({ x: Math.trunc(x + i * perChar), chord: part });
      pos = i + part.length;
    }
  }
  return out.map(({ x, chord }) => ({ x, chord: normalizeChordGlyphs(chord) }));
}

/** Python's round(): halves go to the even neighbour. */
function roundHalfEven(value: number): number {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff > 0.5) return floor + 1;
  if (diff < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

/**
 * Positioned chords → a chord line whose columns match the characters of the
 * lyric row below. Each x maps proportionally to a column, snaps to the start
 * of the word it falls in (chords sit on the stressed syllable, in Danish
 * usually the first; within 3 characters) and never overlaps the chord before.
 */
export function alignChords(tokens: readonly { x: number; chord: string }[], target: Row): string {
  const raw = rowRaw(target); // trailing spaces kept: they are in the run width
  const text = cleanRunText(raw);
  const lead = raw.length - raw.trimStart().length;
  const left = rowLeft(target);
  const perChar = (rowRight(target) - left) / Math.max(raw.length, 1);
  const wordStarts = [...text.matchAll(/\S+/g)].map((m) => m.index);
  let line = "";
  for (const { x, chord } of tokens) {
    let col = Math.max(0, roundHalfEven((x - left) / perChar) - lead);
    const near = wordStarts.filter((w) => col - w >= -1 && col - w <= 3);
    const snap = near[near.length - 1];
    if (snap !== undefined) col = snap;
    if (line.length > 0 && col <= line.length) col = line.length + 1;
    line = line.padEnd(col) + chord;
  }
  return line;
}
