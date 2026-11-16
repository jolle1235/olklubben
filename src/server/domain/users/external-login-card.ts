import type { ExternalProviderId } from "@/lib/auth-providers";

/**
 * The external-login card on Profil (SPEC §9.8, D-165, D-166, D-179): "link"
 * ("Forbind Google") only for a password account without any external login;
 * "linked" ("Google er forbundet.") right after connecting (?external=linked,
 * and only when the account really has the configured login now); otherwise
 * null: an account that already logs in with Google or Auth0 has no card. Pure.
 */
export function externalLoginCard(input: {
  configured: ExternalProviderId | null;
  hasPassword: boolean;
  external: readonly ExternalProviderId[];
  linkedParam: boolean;
}): "link" | "linked" | null {
  const { configured, hasPassword, external, linkedParam } = input;
  if (configured === null) return null;
  if (linkedParam && external.includes(configured)) return "linked";
  return hasPassword && external.length === 0 ? "link" : null;
}
