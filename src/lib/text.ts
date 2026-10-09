/**
 * Shared hygiene for free-text input.
 *
 * Postgres `text` cannot hold U+0000, so a NUL in a form field made the write
 * fail with the generic error. The text schemas strip it silently, the same
 * way they trim and collapse whitespace.
 *
 * Name keys (D-086, D-095): two names are "the same" when they only differ in
 * case or whitespace ("Hos Mads" ≡ " hos  MADS " ≡ "HosMads"). One rule for
 * beers (the duplicate warning, E21) and places (one active place per name).
 * The round-3 migration mirrors nameKey in SQL (prisma/migrations/
 * *_round3_places_hosts_nickname, D-097): keep the two in step.
 *
 * Client-safe: no server-only imports.
 */

/** Removes every U+0000 ("Westmalle\u0000 Tripel" → "Westmalle Tripel"). */
export function stripNul(value: string): string {
  // A string, not /\u0000/g: ESLint's no-control-regex rejects control characters in a regex.
  return value.replaceAll("\u0000", "");
}

/**
 * One line of text as it is stored: NUL removed, Unicode NFC (so "ø" typed two
 * ways is the same), every whitespace run (also NBSP, tabs and line breaks)
 * collapsed to one space, trimmed. "  Hos\u00a0 Mads\n" → "Hos Mads".
 */
export function cleanSingleLine(value: string): string {
  return stripNul(value).normalize("NFC").replace(/\s+/g, " ").trim();
}

/**
 * The comparison key of a name: cleaned, lower-cased the Danish way ("Ø" →
 * "ø") and without ANY whitespace. "Hos Mads" and " HOS  mads" → "hosmads".
 * "" for a name without visible characters.
 */
export function nameKey(value: string): string {
  return cleanSingleLine(value).toLocaleLowerCase("da").replace(/\s/g, "");
}
