/**
 * The name shown for a user everywhere in the app (SPEC §7.4, §9.8, D-105).
 *
 * Nickname wins over name (the global User.nickname, D-011). A missing user
 * (deleted account) is shown as "Tidligere medlem". Only the member list and
 * the profile also show the official name: "Kaptajnen (Jesper Thomsen)".
 * Emails keep the official name.
 *
 * Client-safe: no server-only imports.
 */

import { nameKey } from "@/lib/text";

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

/**
 * The official name to show in parentheses after the nickname, or null: only
 * when a nickname is shown and it is not just the name again ("jesper" for
 * "Jesper" adds nothing).
 */
export function officialNameSuffix(user: DisplayNameUser | null | undefined): string | null {
  const nickname = user?.nickname?.trim();
  const name = user?.name.trim();
  if (!nickname || !name) return null;
  return nameKey(nickname) === nameKey(name) ? null : name;
}

/** "Kaptajnen (Jesper Thomsen)", "Jesper Thomsen" or "Tidligere medlem" (member list, profile). */
export function formatMemberName(user: DisplayNameUser | null | undefined): string {
  const displayName = getDisplayName(user);
  const suffix = officialNameSuffix(user);
  return suffix ? `${displayName} (${suffix})` : displayName;
}

// Danish alphabet: Æ, Ø and Å come after Z. Case and accents only break ties.
const collator = new Intl.Collator("da", { sensitivity: "base" });
const tieBreaker = new Intl.Collator("da");

/** By display name in Danish order, then exact spelling, then id (stable). */
export function compareByDisplayName(
  a: DisplayNameUser & { id: string },
  b: DisplayNameUser & { id: string },
): number {
  const nameA = getDisplayName(a);
  const nameB = getDisplayName(b);
  return (
    collator.compare(nameA, nameB) ||
    tieBreaker.compare(nameA, nameB) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}
