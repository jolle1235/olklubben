/**
 * The claims Ølklubben reads from an external login's id token (Google or
 * Auth0, SPEC §6.2, D-165, D-166), and which Auth0 connections may log in.
 *
 * Auth0's token was verified against the tenant's JWKS (issuer, audience,
 * nonce) before Better Auth stores it (requireIdTokenVerification). Google's
 * is decoded without a signature check on the callback path, which is safe:
 * it comes straight from Google's token endpoint over TLS, in exchange for our
 * client secret and the PKCE verifier. Sign-in with a client-supplied id token
 * is refused for every provider (authBeforeHook), so a stored token always
 * came from a callback.
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
  /** When the user last authenticated at the provider (auth_time), or null. */
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
 * Auth0 connections allowed to log in (D-166): Google ("google-oauth2|…") and
 * Auth0's own database ("auth0|…"). Enterprise, SAML or custom connections in
 * the tenant can claim email_verified=true for any address, so they never get
 * in, even if someone enables them on the application in Auth0.
 */
const ALLOWED_AUTH0_SUBJECT_PREFIXES = ["google-oauth2|", "auth0|"] as const;

export function isAllowedAuth0Subject(subject: string): boolean {
  return ALLOWED_AUTH0_SUBJECT_PREFIXES.some(
    (prefix) => subject.startsWith(prefix) && subject.length > prefix.length,
  );
}
