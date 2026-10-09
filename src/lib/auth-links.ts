import { safeRedirectPath } from "@/lib/safe-redirect";
import { firstParam, type SearchParamValue } from "@/lib/search-params";

/**
 * ?next= handling for the auth pages (SPEC §6.5, §10.1, §10.7).
 *
 * An invite link survives login/signup because the join page sends logged-out
 * users to /login?next=/join/<code> (or /signup?next=…). Every link between
 * login, signup and "Glemt password" carries `next` along, and after success
 * the user lands on it, or on "/" (which routes onward per §10.1).
 *
 * Pure and client-safe.
 */

// Re-exported for the auth pages and their tests (moved to src/lib/search-params.ts).
export { firstParam, type SearchParamValue };

/** The validated ?next= path, or null when missing or unsafe (open redirect). */
export function readNextParam(value: SearchParamValue): string | null {
  return safeRedirectPath(firstParam(value));
}

/** Where to go after login/signup: the safe `next` path, or "/" (§10.1 routing). */
export function afterAuthPath(next: unknown): string {
  return safeRedirectPath(next) ?? "/";
}

/** `path` with ?next= appended when `next` is a safe path: withNext("/signup", "/join/K7XMQ2PA"). */
export function withNext(path: string, next: string | null | undefined): string {
  const safeNext = safeRedirectPath(next);
  if (!safeNext) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}next=${encodeURIComponent(safeNext)}`;
}

/** True when `next` is an invitation link, so the copy can mention the invitation. */
export function isInvitePath(next: string | null | undefined): boolean {
  return typeof next === "string" && /^\/join\/[^/?#]+/.test(next);
}
