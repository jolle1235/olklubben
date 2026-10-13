/**
 * Chord tokens for the song-text format (SPEC §9.6): what counts as a chord
 * ("Am", "C#m7", "D/F#", "H", "N.C.", "(G)") and what is a chord-sheet marker
 * ("x2", "|", "%", "…"). The regexes behind lineKind() in song-text.ts.
 *
 * Case-sensitive on purpose: roots are upper-case A–H (H is the Danish/German
 * B), so the words "am" and "e" are never chords. A line counts as a chord
 * line when every token is a chord or a marker and at least one is a chord.
 *
 * Every regex here is anchored at both ends and runs on one short token at a
 * time; tokens longer than CHORD_TOKEN_MAX_LENGTH are refused before any regex
 * (F-044, D-090).
 *
 * Pure module: no Next.js, React or database imports. Client-safe; also used
 * by the importer (scripts/songbook/**).
 */

/** No real chord or marker is this long ("Bbmaj7(add9)/D" is 14). */
const CHORD_TOKEN_MAX_LENGTH = 24;

const SUPERSCRIPTS: Record<string, string> = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
  "⁺": "+",
  "⁻": "-",
};

const GLYPHS: Record<string, string> = {
  "♭": "b",
  "♯": "#",
  // ChordBank's superscript-style minor.
  ᶆ: "m",
  ᵐ: "m",
  "°": "dim",
  º: "dim",
  "−": "-",
  "＃": "#",
};

const GLYPH_RE = /[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻♭♯ᶆᵐ°º−＃]/g;

/** Unicode chord glyphs → ASCII: "F♯ᶆ⁷" → "F#m7", "B♭" → "Bb", "C°" → "Cdim". Only for chord text. */
export function normalizeChordGlyphs(text: string): string {
  return text.replace(GLYPH_RE, (glyph) => SUPERSCRIPTS[glyph] ?? GLYPHS[glyph] ?? glyph);
}

// root + accidental, quality, 5 6 7 9 11 13, extensions (sus4 add9 b5 #9 6/9),
// bare sus, a parenthesised alteration ((b5) (maj7)), slash bass.
const CHORD_RE =
  /^[A-H](?:#|b)?(?:maj|Maj|ma|M|min|mi|m|dim|aug|\+|ø|-)?(?:\d{1,2})?(?:(?:maj|sus|add|b|#|\+|-|\/)\d{1,2})*(?:sus)?(?:\([^()\s]{1,8}\))?(?:\/[A-H](?:#|b)?)?$/;

// Repeats (x2, 2x, (x2), (2x)), bars (| || :| |:), slashes, holds (- – %) and ellipses.
const MARKER_RE =
  /^(?:[x×]\d{1,2}|\d{1,2}[x×]|\([x×]\d{1,2}\)|\(\d{1,2}[x×]\)|\|+|:\||\|:|\/+|-|–|%|\.\.\.|…)$/;

const NO_CHORD_RE = /^N\.?C\.?$/;

/**
 * A chord: "A", "Am", "C#m7", "Gsus4", "D/F#", "Bb", "H", "Am7b5", "C6/9",
 * "F#ø7", "C°", "E-", also in parentheses ("(G)") and "N.C." (no chord).
 * Glyphs are normalised first. "am", "e" and "Hej" are not chords.
 */
export function isChordToken(token: string): boolean {
  if (token.length === 0 || token.length > CHORD_TOKEN_MAX_LENGTH) return false;
  const text = normalizeChordGlyphs(token);
  if (CHORD_RE.test(text)) return true;
  if (text.startsWith("(") && text.endsWith(")") && CHORD_RE.test(text.slice(1, -1))) return true;
  return NO_CHORD_RE.test(text);
}

/** A chord-sheet marker that may stand between chords: x2, 2x, (x2), |, ||, :|, |:, /, -, –, %, ..., … */
export function isMarkerToken(token: string): boolean {
  if (token.length === 0 || token.length > CHORD_TOKEN_MAX_LENGTH) return false;
  return MARKER_RE.test(normalizeChordGlyphs(token));
}

/** "N.C." / "NC": stands in for a chord, but is not one to learn ("Akkorder i sangen" leaves it out). */
export function isNoChordToken(token: string): boolean {
  return token.length <= CHORD_TOKEN_MAX_LENGTH && NO_CHORD_RE.test(normalizeChordGlyphs(token));
}

/** The whitespace-separated tokens of a line. */
export function lineTokens(line: string): string[] {
  return line.split(/\s+/).filter((token) => token !== "");
}

/**
 * True when every token is a chord or a marker and at least one is a chord
 * ("G C D x2", "|: G :|"). A lone "(x2)" is not a chord line, so it stays
 * visible as lyric. False for a blank line.
 */
export function isChordLine(line: string): boolean {
  let chords = 0;
  for (const token of lineTokens(line)) {
    if (isChordToken(token)) chords += 1;
    else if (!isMarkerToken(token)) return false;
  }
  return chords > 0;
}

/**
 * The chord a token names, for "Akkorder i sangen": glyphs normalised and
 * parentheses dropped ("(G)" → "G"), or null for a marker or "N.C.".
 */
export function chordName(token: string): string | null {
  if (!isChordToken(token) || isNoChordToken(token)) return null;
  const text = normalizeChordGlyphs(token);
  return text.startsWith("(") && text.endsWith(")") && CHORD_RE.test(text.slice(1, -1))
    ? text.slice(1, -1)
    : text;
}
