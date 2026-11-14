/**
 * The one external login: Google, directly via Better Auth (SPEC §6.2,
 * D-165, D-178). On only when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are
 * set (isGoogleConfigured in src/env.ts). Client-safe.
 */

/** Better Auth's provider id, and accounts.provider_id for a Google login. */
export const GOOGLE_PROVIDER_ID = "google";
