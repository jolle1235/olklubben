/**
 * App paths that need a logged-in user (SPEC §8.2, round 1). Used by the
 * optimistic redirect in src/proxy.ts; the real check is requireUser().
 *
 * Not protected: /join/* (the join page handles logged-out users itself),
 * /login, /signup, /forgot-password, /reset-password and /api/*.
 *
 * Keep in sync with `config.matcher` in src/proxy.ts (matchers must be literals).
 */

export const PROTECTED_SECTIONS = ["/c", "/onboarding", "/clubs", "/profile"] as const;

/** "/", and "/c", "/onboarding", "/clubs", "/profile" with everything below them. */
export function isProtectedPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PROTECTED_SECTIONS.some(
    (section) => pathname === section || pathname.startsWith(`${section}/`),
  );
}

/**
 * Request header the proxy sets on protected GET/HEAD requests that carry a
 * session cookie: the requested path + query. If the cookie turns out to be
 * stale (expired session, password reset), requireUser() reads it and keeps
 * the deep link as /login?next=…. The proxy strips any incoming copy, so a
 * client can never set it; requireUser() still validates it (safeRedirectPath).
 */
export const RETURN_TO_HEADER = "x-olk-return-to";
