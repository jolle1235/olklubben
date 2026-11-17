/**
 * The Google-login card on Profil (SPEC §9.8, D-165, D-180, D-179): "link"
 * ("Forbind Google") only for a password account without Google; "linked"
 * ("Google er forbundet.") right after connecting (?external=linked, and only
 * when the account really has Google now); otherwise null: an account that
 * already logs in with Google has no card. Pure.
 */
export function externalLoginCard(input: {
  googleConfigured: boolean;
  hasPassword: boolean;
  hasGoogle: boolean;
  linkedParam: boolean;
}): "link" | "linked" | null {
  const { googleConfigured, hasPassword, hasGoogle, linkedParam } = input;
  if (!googleConfigured) return null;
  if (linkedParam && hasGoogle) return "linked";
  return hasPassword && !hasGoogle ? "link" : null;
}
