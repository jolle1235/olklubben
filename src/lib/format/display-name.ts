/**
 * The name shown for a user everywhere in the app (SPEC §7.4, §9.8).
 *
 * Nickname wins over name (the global nickname arrives in round 3, D-011). A
 * missing user (deleted account) is shown as "Tidligere medlem".
 *
 * Client-safe: no server-only imports.
 */

export const FORMER_MEMBER_NAME = "Tidligere medlem";

export type DisplayNameUser = {
  name: string;
  nickname?: string | null;
};

export function getDisplayName(user: DisplayNameUser | null | undefined): string {
  if (!user) return FORMER_MEMBER_NAME;
  const nickname = user.nickname?.trim();
  if (nickname) return nickname;
  const name = user.name.trim();
  return name || FORMER_MEMBER_NAME;
}
