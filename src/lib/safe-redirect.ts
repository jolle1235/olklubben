/**
 * Validates the `?next=` parameter used after login/signup (SPEC §6.5), so it
 * can never send the user to another site (open redirect).
 *
 * Accepted: a same-origin relative path such as "/join/K7XMQ2PA" or
 * "/c/<id>/beers?sort=name". Rejected (→ null): anything that is not a string,
 * absolute URLs ("https://…", "javascript:…"), protocol-relative URLs
 * ("//evil.com"), backslash tricks ("/\evil.com") and control characters or
 * whitespace (browsers strip tabs/newlines, turning "/\t/evil.com" into
 * "//evil.com").
 *
 * Client-safe: no server-only imports.
 */

const MAX_LENGTH = 2048;
const ORIGIN = "http://safe-redirect.invalid";

// Control characters (including tab and newline), whitespace and backslashes.
const FORBIDDEN_CHARACTERS = /[\u0000-\u001F\u007F\s\\]/;

export function safeRedirectPath(next: unknown): string | null {
  if (typeof next !== "string") return null;
  if (next.length === 0 || next.length > MAX_LENGTH) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  if (FORBIDDEN_CHARACTERS.test(next)) return null;

  let url: URL;
  try {
    url = new URL(next, ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== ORIGIN) return null;

  const path = `${url.pathname}${url.search}${url.hash}`;
  // The URL parser may collapse "/./" or "/../" segments into "//"-prefixed paths.
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}
