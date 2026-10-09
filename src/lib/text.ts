/**
 * Shared hygiene for free-text input.
 *
 * Postgres `text` cannot hold U+0000, so a NUL in a form field made the write
 * fail with the generic error. The text schemas strip it silently, the same
 * way they trim and collapse whitespace.
 *
 * Client-safe: no server-only imports.
 */

/** Removes every U+0000 ("Westmalle\u0000 Tripel" → "Westmalle Tripel"). */
export function stripNul(value: string): string {
  // A string, not /\u0000/g: ESLint's no-control-regex rejects control characters in a regex.
  return value.replaceAll("\u0000", "");
}
