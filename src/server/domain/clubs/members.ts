/**
 * Member list helpers (SPEC §9.8 "Klubindstillinger", round 1: list only).
 *
 * Pure module: no Next.js, React or database imports.
 */

import { getDisplayName } from "@/lib/format/display-name";

import type { ClubRole } from "./permissions";

/** The fields the member list sorts by. */
export type SortableMember = {
  userId: string;
  role: ClubRole;
  name: string;
  nickname?: string | null;
};

const ROLE_ORDER: Record<ClubRole, number> = { ADMIN: 0, MEMBER: 1 };

// Danish alphabet: Æ, Ø and Å come after Z. Case and accents only break ties.
const collator = new Intl.Collator("da", { sensitivity: "base" });
const tieBreaker = new Intl.Collator("da");

/** Admins first, then by display name (Danish order), then by name/id so the order is stable. */
export function compareMembers(a: SortableMember, b: SortableMember): number {
  const nameA = getDisplayName(a);
  const nameB = getDisplayName(b);
  return (
    ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
    collator.compare(nameA, nameB) ||
    tieBreaker.compare(nameA, nameB) ||
    (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0)
  );
}

/** A sorted copy of the members (the input is not changed). */
export function sortMembers<T extends SortableMember>(members: readonly T[]): T[] {
  return [...members].sort(compareMembers);
}

/** "1 medlem", "8 medlemmer" (SPEC §10.7). */
export function memberCountLabel(count: number): string {
  return count === 1 ? "1 medlem" : `${count} medlemmer`;
}
