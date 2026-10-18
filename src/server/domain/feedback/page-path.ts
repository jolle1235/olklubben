import { stripNul } from "@/lib/text";

/**
 * The "Side" of a bug report (SPEC §9.9, E26, D-143): the app path the report
 * is about, WITHOUT anything that belongs to a club or a person. Reports are
 * visible to every user of the app (§3.3), so:
 *
 *   * the club segment goes: "/c/<clubId>/calendar" → "/calendar",
 *     "/c/<clubId>" and "/c/<clubId>/" → "/" (whatever the segment looks like,
 *     a valid uuid or not);
 *   * an invitation code is a secret: "/join/<code>" → "/join";
 *   * the query and the hash are dropped ("?q=", "?token=…", "#stem");
 *   * only a path is accepted: exactly one leading "/", no "\", no control
 *     characters, so never "//evil.example", "https://…" or "javascript:…".
 *
 * Repeated slashes are collapsed, a trailing slash is dropped (except for
 * "/"), and the result is cut at 200 characters (the CHECK
 * feedback_page_path_check). Anything else → null (no page).
 *
 * The ONE function used by the "Rapportér denne fejl" link (newFeedbackHref),
 * the /feedback/new prefill and again by the create action, so the club id
 * never reaches a URL, a form or the database.
 *
 * Pure module: no Next.js, React or database imports. Client-safe.
 */

export const FEEDBACK_PAGE_PATH_MAX_LENGTH = 200;

/** Longer raw input is refused before any work (D-090). */
const RAW_MAX_LENGTH = 2048;

/** C0 controls, DEL and C1 controls (a loop: no-control-regex forbids them in a regex). */
function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return true;
  }
  return false;
}

function withoutTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

export function toFeedbackPagePath(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > RAW_MAX_LENGTH) return null;
  const value = stripNul(raw).trim();
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\") || hasControlCharacter(value)) return null;

  // Up to the first "?" or "#", repeated slashes collapsed.
  const path = (value.split(/[?#]/, 1)[0] ?? "").replace(/\/{2,}/g, "/");

  // ["c", "<clubId>", "calendar"] for "/c/<clubId>/calendar".
  const segments = path.slice(1).split("/");
  const first = segments[0]?.toLowerCase();
  let result: string;
  if (first === "c") result = `/${segments.slice(2).join("/")}`;
  else if (first === "join") result = "/join";
  else result = path;

  result = withoutTrailingSlash(
    withoutTrailingSlash(result).slice(0, FEEDBACK_PAGE_PATH_MAX_LENGTH),
  );
  return result === "" ? null : result;
}
