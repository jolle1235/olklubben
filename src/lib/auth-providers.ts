/**
 * External logins (SPEC §6.2, D-165, D-166): Google directly, or Auth0
 * Universal Login (where Google is one of the choices). At most one is
 * active at a time (externalProvider in src/env.ts); Auth0 wins when both
 * are configured.
 *
 * Pure and client-safe: labels and button texts only.
 */

export const EXTERNAL_PROVIDERS = {
  google: {
    label: "Google",
    signIn: "Fortsæt med Google",
    link: "Forbind Google",
    reauth: "Log ind med Google igen",
  },
  auth0: {
    label: "Auth0",
    signIn: "Fortsæt med Auth0",
    link: "Forbind Auth0",
    reauth: "Log ind med Auth0 igen",
  },
} as const;

export type ExternalProviderId = keyof typeof EXTERNAL_PROVIDERS;

/** True for "google" and "auth0"; false for "credential" (password) and anything unknown. */
export function isExternalProvider(providerId: string): providerId is ExternalProviderId {
  return Object.hasOwn(EXTERNAL_PROVIDERS, providerId);
}
