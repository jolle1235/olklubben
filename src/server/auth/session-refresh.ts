/**
 * Session lifetime (D-030) and when to slide it forward. Pure module: no
 * Better Auth, Next.js or database imports, so it is unit-testable.
 *
 * Better Auth only refreshes a session where it can also re-issue the cookie:
 * Server Components cannot write cookies, so src/server/auth/session.ts reads
 * the session with refresh disabled. Pages render <SessionRefresh /> instead,
 * which lets the browser call GET /api/auth/get-session (a Route Handler) when
 * a refresh is due. That moves the expiry in the database AND re-issues the
 * cookie with the new Max-Age.
 */

/** Sessions last 60 days … */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 60;

/** … and slide forward once a day while in use. */
export const SESSION_REFRESH_SECONDS = 60 * 60 * 24;

/**
 * True when Better Auth's get-session would refresh this session: the session
 * was last refreshed (or created) at least SESSION_REFRESH_SECONDS ago. Same
 * formula as Better Auth's `shouldBeUpdated` (better-auth api/routes/session).
 */
export function isSessionRefreshDue(expiresAt: Date, now: number = Date.now()): boolean {
  return expiresAt.getTime() - SESSION_TTL_SECONDS * 1000 + SESSION_REFRESH_SECONDS * 1000 <= now;
}
