import { stripNul } from "@/lib/text";

import { chordName, isChordLine, isChordToken, lineTokens, normalizeChordGlyphs } from "./chords";

/**
 * The song-text format (SPEC §9.6): one plain-text `Song.body` per song,
 * "chords over lyrics". Classified when the song is SHOWN, never stored:
 *
 *   * a blank line starts a new stanza;
 *   * "[Omkvæd]", "[Vers 2]" (or a bare "Chorus:", "SOLO") is a section label;
 *   * "capo: 2" is a player note (shown only with chords);
 *   * a line of chords is a chord row: single-spaced ("G C D x2") it is a
 *     sequence shown above the text; with a leading space or a gap of 2+
 *     spaces it is POSITIONED and pairs with the lyric line below it (each
 *     chord over the syllable in its column);
 *   * everything else is lyric. A line starting with "\" is always lyric and
 *     the backslash is not shown (for a lyric line that reads as a chord,
 *     e.g. a lone "A").
 *
 * NEVER search or show `body` raw: use parseSong() and lyricsOnlyLines().
 * Shared by the reader, the admin preview, search (via the list query) and the
 * importer (scripts/songbook/**). A port of the prototype that classified all
 * 3,785 lines of the real songbook like the PDF fonts did, with two changes:
 * the tightened note rule and the "\" escape.
 *
 * Pure module: no Next.js, React or database imports. Client-safe.
 */

/** The largest real song is about 3,000 characters. */
export const SONG_BODY_MAX_LENGTH = 20_000;

export type SongLineKind = "blank" | "section" | "note" | "chords" | "lyric";

/** One chord (or none) over a fragment of a word. `hang`: the chord takes no width (it hangs over the text). */
export type WordPiece = { chord: string | null; text: string; hang: boolean };
/** An unbreakable word of a chord-over-lyric pair. */
export type WordBox = { pieces: WordPiece[] };

export type SongLine =
  | { kind: "lyric"; text: string }
  /** Tokens as written, glyphs normalised: chords and markers ("G", "C", "x2", "|"). */
  | { kind: "chords"; chords: string[] }
  /** A positioned chord line with its lyric line. `text` is the plain lyric. */
  | { kind: "pair"; text: string; boxes: WordBox[] }
  | { kind: "note"; text: string };

export type SongStanza = {
  /** The Danish label ("Omkvæd", "Vers 2"), or null. */
  label: string | null;
  /** No lyric or pair line (Intro, Solo …): left out of the lyrics view. */
  instrumental: boolean;
  /** Its lyrics occur 2+ times in the song (chorus styling). */
  repeated: boolean;
  lines: SongLine[];
};

// ─── Cleaning ───────────────────────────────────────────────────────────────

// C0/C1 controls except \t and \n (tabs are expanded below), and zero-width characters.
const INVISIBLE_RE = /[\u0001-\u0008\u000b-\u001f\u007f-\u009f\u200b-\u200d\u2060\ufeff]/g;
const OTHER_SPACE_RE = /\p{Zs}/gu;
const TAB_STOP = 8;

function expandTabs(line: string): string {
  if (!line.includes("\t")) return line;
  let out = "";
  let column = 0;
  for (const char of line) {
    if (char === "\t") {
      const spaces = TAB_STOP - (column % TAB_STOP);
      out += " ".repeat(spaces);
      column += spaces;
    } else {
      out += char;
      column += 1;
    }
  }
  return out;
}

/**
 * How a body is stored (NOT cleanSingleLine: leading and inner spaces carry
 * chord columns). NUL and other controls and zero-width characters removed,
 * CRLF/CR and U+2028/U+2029 → LF, NBSP and other spaces → " ", NFC, tabs
 * expanded to 8-column stops, every line right-trimmed, any run of blank
 * lines → one blank line, no blank lines at the ends. Idempotent.
 */
export function cleanSongText(raw: string): string {
  const text = stripNul(raw)
    .replace(/\r\n?|[\u2028\u2029]/g, "\n")
    .replace(INVISIBLE_RE, "")
    .replace(OTHER_SPACE_RE, " ")
    .normalize("NFC");
  const lines: string[] = [];
  for (const line of text.split("\n")) {
    const cleaned = expandTabs(line).trimEnd();
    if (cleaned === "" && (lines.length === 0 || lines[lines.length - 1] === "")) continue;
    lines.push(cleaned);
  }
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

// ─── Line kinds ─────────────────────────────────────────────────────────────

const SECTION_WORDS =
  "intro|verse|vers|chorus|omkvæd|refrain|kor|bro|bridge|interlude|mellemspil|outro|outtro|forspil|efterspil|solo|pre-chorus|prechorus|instrumental|riff|coda|ending";
const BARE_SECTION_RE = new RegExp(`^(?:${SECTION_WORDS})(?:\\s*\\d{1,3})?:?$`, "i");
const BRACKET_RE = /^\[([^[\]]{1,30})\]$/;
// Tightened from the prototype's \b: "Stemning i lejren" and "Tempo, tempo" are lyrics.
const NOTE_RE = /^(?:(?:capo|tuning|stemning|tempo|bpm)\s*[:=]|capo\s+\d)/i;
const LABEL_RE = /^(\D+?)\s*(\d+)?$/;

const DANISH_LABELS: Record<string, string> = {
  intro: "Intro",
  verse: "Vers",
  vers: "Vers",
  chorus: "Omkvæd",
  omkvæd: "Omkvæd",
  refrain: "Omkvæd",
  interlude: "Mellemspil",
  mellemspil: "Mellemspil",
  outro: "Outro",
  outtro: "Outro",
  forspil: "Forspil",
  solo: "Solo",
  bridge: "Bro",
  bro: "Bro",
};

/** "Chorus" → "Omkvæd", "verse 2" → "Vers 2", "SOLO" → "Solo"; other words in sentence case. */
function danishLabel(label: string): string {
  const match = LABEL_RE.exec(label.trim());
  if (!match?.[1]) return label.trim();
  const word = match[1].trim();
  const danish =
    DANISH_LABELS[word.toLocaleLowerCase("da")] ??
    word.charAt(0).toLocaleUpperCase("da") + word.slice(1).toLocaleLowerCase("da");
  return match[2] ? `${danish} ${match[2]}` : danish;
}

/** True when the line starts (after spaces) with the "\" escape: always lyric. */
function isEscaped(line: string): boolean {
  return line.trimStart().startsWith("\\");
}

/** The line without its "\" escape. */
function unescapeLine(line: string): string {
  return isEscaped(line) ? line.replace("\\", "") : line;
}

/**
 * The Danish display label of a section line ("[Chorus]" → "Omkvæd",
 * "Vers 2:" → "Vers 2"), or null when the line is not a label. "[G]" and
 * "[Am C]" are chords in brackets, not labels.
 */
export function sectionLabel(line: string): string | null {
  const text = line.trim();
  if (text.length > 40 || isEscaped(line)) return null;
  const bracket = BRACKET_RE.exec(text);
  if (bracket?.[1] !== undefined) {
    const inner = bracket[1].trim();
    if (inner === "" || lineTokens(inner).every(isChordToken)) return null;
    return danishLabel(inner);
  }
  return BARE_SECTION_RE.test(text) ? danishLabel(text.replace(/:$/, "")) : null;
}

/** What a stored line is (see the module comment for the priority). */
export function lineKind(line: string): SongLineKind {
  if (isEscaped(line)) return "lyric";
  if (line.trim() === "") return "blank";
  if (sectionLabel(line) !== null) return "section";
  if (NOTE_RE.test(line.trim())) return "note";
  return isChordLine(line) ? "chords" : "lyric";
}

/** A chord line aligned to the lyric below it: a leading space or a gap of 2+ spaces. */
export function isPositionedChordLine(line: string): boolean {
  return line.startsWith(" ") || line.trim().includes("  ");
}

// ─── Chord-over-lyric pairs ─────────────────────────────────────────────────

/**
 * Splits the lyric at the chord line's columns and groups the pieces into
 * unbreakable words, so a chord placed mid-word never splits it. A chord
 * hangs (takes no width) when the text up to the next chord is at least one
 * character longer than the chord; otherwise it widens its fragment. A chord
 * beyond the end of the lyric becomes a trailing piece.
 */
export function wordBoxes(chordLine: string, lyric: string): WordBox[] {
  const columns = [...chordLine.matchAll(/\S+/g)].map((m) => ({ at: m.index, chord: m[0] }));
  const segments: { chord: string | null; text: string }[] = [];
  if (columns.length === 0) segments.push({ chord: null, text: lyric });
  else if (columns[0] && columns[0].at > 0) {
    segments.push({ chord: null, text: lyric.slice(0, columns[0].at) });
  }
  columns.forEach(({ at, chord }, k) => {
    const end = columns[k + 1]?.at ?? Math.max(lyric.length, at);
    segments.push({ chord: normalizeChordGlyphs(chord), text: lyric.slice(at, end) });
  });

  const pieces: WordPiece[] = [];
  for (const segment of segments) {
    const parts = segment.text.match(/\S*\s*/g)?.filter((part) => part !== "") ?? [];
    if (parts.length === 0) parts.push(" ");
    parts.forEach((text, i) => {
      pieces.push({ chord: i === 0 ? segment.chord : null, text, hang: false });
    });
  }
  pieces.forEach((piece, k) => {
    if (piece.chord === null) return;
    let room = piece.text.length;
    for (let j = k + 1; j < pieces.length && pieces[j]?.chord === null; j++) {
      room += pieces[j]?.text.length ?? 0;
    }
    piece.hang = room >= piece.chord.length + 1;
  });

  const boxes: WordBox[] = [];
  for (const piece of pieces) {
    const last = boxes[boxes.length - 1];
    const lastPiece = last?.pieces[last.pieces.length - 1];
    if (last && lastPiece && !/\s$/.test(lastPiece.text)) last.pieces.push(piece);
    else boxes.push({ pieces: [piece] });
  }
  return boxes;
}

// ─── Parsing ────────────────────────────────────────────────────────────────

function stanzaKey(stanza: SongStanza): string {
  return stanza.lines
    .map((line) => (line.kind === "lyric" || line.kind === "pair" ? line.text : ""))
    .filter((text) => text !== "")
    .map((text) => text.replace(/\s+/g, " ").toLocaleLowerCase("da"))
    .join("\n");
}

/**
 * The body as stanzas of lines. A blank line or a label starts a new stanza
 * (a blank line right after a label keeps the label for the lines that
 * follow). A positioned chord line followed by a lyric line becomes a pair;
 * without a lyric line after it, it is a chord row.
 */
export function parseSong(body: string): SongStanza[] {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  const stanzas: SongStanza[] = [];
  let current: SongStanza = { label: null, instrumental: true, repeated: false, lines: [] };
  const flush = () => {
    if (current.lines.length > 0 || current.label !== null) stanzas.push(current);
    current = { label: null, instrumental: true, repeated: false, lines: [] };
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const kind = lineKind(line);
    if (kind === "blank") {
      if (current.lines.length > 0) flush();
    } else if (kind === "section") {
      flush();
      current.label = sectionLabel(line);
    } else if (kind === "note") {
      current.lines.push({ kind: "note", text: line.trim() });
    } else if (kind === "chords") {
      const next = lines[i + 1];
      if (isPositionedChordLine(line) && next !== undefined && lineKind(next) === "lyric") {
        // The escape becomes a space, so the lyric keeps the chord line's columns.
        const lyric = isEscaped(next) ? next.replace("\\", " ") : next;
        current.lines.push({ kind: "pair", text: lyric.trim(), boxes: wordBoxes(line, lyric) });
        i += 1;
      } else {
        current.lines.push({ kind: "chords", chords: lineTokens(normalizeChordGlyphs(line)) });
      }
    } else {
      current.lines.push({ kind: "lyric", text: unescapeLine(line).trim() });
    }
  }
  flush();

  const counts = new Map<string, number>();
  for (const stanza of stanzas) {
    stanza.instrumental = !stanza.lines.some((l) => l.kind === "lyric" || l.kind === "pair");
    const key = stanzaKey(stanza);
    if (key !== "") counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const stanza of stanzas) stanza.repeated = (counts.get(stanzaKey(stanza)) ?? 0) >= 2;
  return stanzas;
}

/** The lyric lines and pair texts in order, escape removed: no chords, notes, labels or blank lines. */
export function lyricsOnlyLines(body: string): string[] {
  return parseSong(body).flatMap((stanza) =>
    stanza.lines.flatMap((line) =>
      line.kind === "lyric" || line.kind === "pair" ? [line.text] : [],
    ),
  );
}

/** "Akkorder i sangen": every chord once, glyphs normalised, in order of first appearance. */
export function deriveChords(body: string): string[] {
  const chords: string[] = [];
  for (const line of body.split("\n")) {
    if (lineKind(line) !== "chords") continue;
    for (const token of lineTokens(line)) {
      const name = chordName(token);
      if (name !== null && !chords.includes(name)) chords.push(name);
    }
  }
  return chords;
}

/** True when the song has at least one chord line (the reader offers "Akkorder"). */
export function hasChords(body: string): boolean {
  return body.split("\n").some((line) => lineKind(line) === "chords");
}
