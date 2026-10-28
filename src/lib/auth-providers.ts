/**
 * Labels and button texts for the external logins (SPEC §6.2): Google
 * directly, or Auth0 Universal Login. At most one is active (externalProvider
 * in src/env.ts). Client-safe.
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

/** False for "credential" (password) and unknown ids. */
export function isExternalProvider(providerId: string): providerId is ExternalProviderId {
  return Object.hasOwn(EXTERNAL_PROVIDERS, providerId);
}
