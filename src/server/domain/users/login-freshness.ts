/**
 * "Tilføj password" needs a recent login (SPEC §9.8, D-152).
 *
 * A Google-only account has no password to confirm, and Better Auth's
 * setPassword has no freshness check of its own. So the app asks for a recent
 * Google login instead, read from the session's createdAt:
 *
 *   * Every session of a Google-only account comes from a Google login: email
 *     sign-in needs a password, sign-up and a password reset create one (the
 *     account is then no longer Google-only), and admin reset links are
 *     refused for Google accounts (D-046).
 *   * Better Auth's sliding refresh (D-030) moves expiresAt and updatedAt,
 *     never createdAt.
 *
 * So a session created less than 10 minutes ago means "logged in with Google
 * less than 10 minutes ago". "Log ind med Google igen" on Profil creates a
 * fresh session.
 *
 * Pure: the clock is passed in.
 */

/** How long after a login "Tilføj password" stays open (10 minutes). */
export const SET_PASSWORD_FRESH_SECONDS = 10 * 60;

/** True when the session was created less than 10 minutes before `now`. */
export function isFreshLogin(sessionCreatedAt: Date, now: Date): boolean {
  const ageMs = now.getTime() - sessionCreatedAt.getTime();
  if (Number.isNaN(ageMs)) return false;
  return ageMs < SET_PASSWORD_FRESH_SECONDS * 1000;
}
