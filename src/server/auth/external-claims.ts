/**
 * The claims read from an external login's id token (SPEC §6.2), and which
 * Auth0 connections may log in.
 *
 * Decoding without a signature check is safe: a stored token always came from
 * a callback (client-supplied id tokens are refused, authBeforeHook). Auth0's
 * was verified against the tenant's JWKS; Google's came straight from Google's
 * token endpoint over TLS for our client secret and PKCE verifier.
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
  authTime: Date | null;
};

export function claimsFromIdToken(idToken: string | null | undefined): IdTokenClaims | null {
  const payload = idToken?.split(".")[1];
  if (!payload) return null;
  try {
    const claims: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof claims !== "object" || claims === null) return null;
    const { email, email_verified, picture, auth_time } = claims as Record<string, unknown>;
    return {
      email: typeof email === "string" ? email.trim().toLowerCase() : null,
      emailVerified: email_verified === true,
      picture: typeof picture === "string" && isAllowedUserImage(picture) ? picture : null,
      authTime:
        typeof auth_time === "number" && Number.isFinite(auth_time)
          ? new Date(auth_time * 1000)
          : null,
    };
  } catch {
    return null;
  }
}

/**
 * Only Google and Auth0's own database (D-166): enterprise, SAML or custom
 * connections can claim email_verified=true for any address, so they never
 * get in, even if enabled on the application in Auth0.
 */
const ALLOWED_AUTH0_SUBJECT_PREFIXES = ["google-oauth2|", "auth0|"] as const;

export function isAllowedAuth0Subject(subject: string): boolean {
  return ALLOWED_AUTH0_SUBJECT_PREFIXES.some(
    (prefix) => subject.startsWith(prefix) && subject.length > prefix.length,
  );
}
