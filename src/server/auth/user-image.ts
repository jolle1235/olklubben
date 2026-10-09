/**
 * Profile pictures (SPEC §6.2, §9.8): in round 1 a user's image is either
 * empty or the picture Google gave us. Anything else – another host, http,
 * javascript:, a non-string – is refused, so nobody can turn their avatar into
 * a tracking pixel for every member who opens the club page.
 *
 * Pure module (no Better Auth or Next.js imports).
 */

const GOOGLE_IMAGE_HOST = "googleusercontent.com";

export const USER_IMAGE_NOT_ALLOWED_MESSAGE = "Profilbilledet kan kun komme fra Google.";

/** True for null or an https URL on googleusercontent.com (e.g. lh3.googleusercontent.com). */
export function isAllowedUserImage(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === GOOGLE_IMAGE_HOST || url.hostname.endsWith(`.${GOOGLE_IMAGE_HOST}`))
    );
  } catch {
    return false;
  }
}
