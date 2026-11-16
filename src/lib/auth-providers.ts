/**
 * Labels and button texts for the external logins (SPEC §6.2): Google
 * directly, or Auth0 Universal Login (shown as "Google", D-179). At most one
 * is active (externalProvider in src/env.ts). Client-safe.
 */

const GOOGLE = {
  label: "Google",
  signIn: "Fortsæt med Google",
  link: "Forbind Google",
  reauth: "Log ind med Google igen",
} as const;

export const EXTERNAL_PROVIDERS = {
  google: GOOGLE,
  // Auth0 Universal Login offers Google, so the UI calls it "Google" (D-179).
  auth0: GOOGLE,
} as const;

export type ExternalProviderId = keyof typeof EXTERNAL_PROVIDERS;

/** False for "credential" (password) and unknown ids. */
export function isExternalProvider(providerId: string): providerId is ExternalProviderId {
  return Object.hasOwn(EXTERNAL_PROVIDERS, providerId);
}
