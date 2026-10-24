/**
 * Text hygiene for ChordBank runs, before anything becomes a stored line:
 *
 *   * ′ (U+2032, the Helvetica fallback glyph ChordBank uses as an
 *     apostrophe) → ', NBSP → space, ligatures ﬁ/ﬂ/ﬀ → fi/fl/ff;
 *   * NUL, C0 controls (except tab and newline), DEL and zero-width
 *     characters removed;
 *   * NFC, runs of spaces and tabs collapsed, trimmed.
 *
 * The stored body is cleaned once more with the app's cleanSongText
 * (to-stored-text.ts); this is only the per-row step of the prototype.
 */

const ODD_CHARS: Record<string, string> = {
  "\u2032": "'",
  "\u00a0": " ",
  "\ufb01": "fi",
  "\ufb02": "fl",
  "\ufb00": "ff",
};
const ODD_CHAR_RE = /[\u2032\u00a0\ufb01\ufb02\ufb00]/g;
// C0 controls except \t and \n, DEL, U+200B–U+200F and U+FEFF.
const CONTROL_RE = /[\u0001-\u0008\u000b-\u001f\u007f\u200b-\u200f\ufeff]/g;

/** One row's text as the parser uses it (see the module comment). */
export function cleanRunText(raw: string): string {
  return raw
    .replaceAll("\u0000", "")
    .replace(ODD_CHAR_RE, (char) => ODD_CHARS[char] ?? char)
    .replace(CONTROL_RE, "")
    .normalize("NFC")
    .replace(/[ \t]+/g, " ")
    .trim();
}

const ALLOWED_CHARS = new Set(
  "abcdefghijklmnopqrstuvwxyzæøåABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ0123456789" +
    " .,;:!?'\"-()[]/&+–—…’‘“”´`éèëüöäáóíúÉÜÖÄÁ#*%",
);

/** Characters outside the expected set ("_", "ñ"), sorted and unique: for the report only. */
export function oddChars(text: string): string[] {
  const odd = new Set<string>();
  for (const char of text) if (char !== "\n" && !ALLOWED_CHARS.has(char)) odd.add(char);
  return [...odd].sort();
}
