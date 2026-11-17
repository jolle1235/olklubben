/**
 * The claims read from a Google login's id token (SPEC §6.2).
 *
 * Decoding without a signature check is safe: a stored token always came from
 * a callback (client-supplied id tokens are refused, authBeforeHook), straight
 * from Google's token endpoint over TLS for our client secret and PKCE verifier.
 *
 * Pure module (no Better Auth or Next.js imports).
 */

import { isAllowedUserImage } from "./user-image";

export type IdTokenClaims = {
  /** Lowercase, or null when missing. */
  email: string | null;
  emailVerified: boolean;
  /** Only an allowed picture (user-image.ts), else null. */
  picture: string | null;
};

export function claimsFromIdToken(idToken: string | null | undefined): IdTokenClaims | null {
  const payload = idToken?.split(".")[1];
  if (!payload) return null;
  try {
    const claims: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof claims !== "object" || claims === null) return null;
    const { email, email_verified, picture } = claims as Record<string, unknown>;
    return {
      email: typeof email === "string" ? email.trim().toLowerCase() : null,
      emailVerified: email_verified === true,
      picture: typeof picture === "string" && isAllowedUserImage(picture) ? picture : null,
    };
  } catch {
    return null;
  }
}
