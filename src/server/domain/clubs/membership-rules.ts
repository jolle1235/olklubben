import { cleanSingleLine } from "@/lib/text";

import type { ClubRole } from "./permissions";

/**
 * Membership administration (SPEC §5, §7.4, §9.8; E2, E3, E25; D-102).
 *
 * One decision function for every change to a club's roster, so the member
 * menu (UI) and the data layer (src/server/clubs/membership.ts, under the
 * club-row lock) always agree:
 *
 *   * setRole: admins only. Demoting the last admin is refused (also yourself;
 *     with two or more admins you may demote yourself).
 *   * remove: admins only, never yourself (use "Forlad klubben"), never the
 *     last admin. Removing someone who is no longer a member is a no-op.
 *   * leave: anyone, except the only member (delete the club instead, E3) and
 *     the last admin (make someone else admin first, E2).
 *
 * The roster is the club's memberships read under the lock, so two admins who
 * demote each other at the same time leave at least one admin (E25).
 *
 * Pure module: no Next.js, React or database imports. Client-safe.
 */

/** userId → role for every member of one club. */
export type Roster = ReadonlyMap<string, ClubRole>;

export type MembershipChange =
  | { kind: "setRole"; targetUserId: string; role: ClubRole }
  | { kind: "remove"; targetUserId: string }
  | { kind: "leave" };

export type MembershipRefusal =
  "NOT_FOUND" | "FORBIDDEN" | "LAST_ADMIN" | "ONLY_MEMBER" | "USE_LEAVE";

export type MembershipDecision =
  { ok: true; effect: "none" | "setRole" | "delete" } | { ok: false; reason: MembershipRefusal };

/** Danish messages for the refusals the UI shows (SPEC §7.4, §13.5). */
export const MEMBERSHIP_MESSAGES = {
  LAST_ADMIN: "Klubben skal have mindst én admin. Gør et andet medlem til admin først.",
  LAST_ADMIN_LEAVE:
    "Du er klubbens eneste admin. Gør et andet medlem til admin, før du forlader klubben.",
  ONLY_MEMBER: "Du er det eneste medlem. Vil du lukke klubben, kan du slette den i stedet.",
  USE_LEAVE: "Brug 'Forlad klubben' for at melde dig selv ud.",
  FORBIDDEN: "Kun admins kan administrere medlemmer.",
} as const;

export function adminCount(roster: Roster): number {
  let count = 0;
  for (const role of roster.values()) if (role === "ADMIN") count += 1;
  return count;
}

const refuse = (reason: MembershipRefusal): MembershipDecision => ({ ok: false, reason });
const allow = (effect: "none" | "setRole" | "delete"): MembershipDecision => ({ ok: true, effect });

/** What the change does to the roster, or why it is refused. */
export function decideMembershipChange(
  actorUserId: string,
  change: MembershipChange,
  roster: Roster,
): MembershipDecision {
  const actorRole = roster.get(actorUserId);
  if (actorRole === undefined) return refuse("NOT_FOUND");

  switch (change.kind) {
    case "setRole": {
      if (actorRole !== "ADMIN") return refuse("FORBIDDEN");
      const targetRole = roster.get(change.targetUserId);
      if (targetRole === undefined) return refuse("NOT_FOUND");
      if (targetRole === change.role) return allow("none");
      if (targetRole === "ADMIN" && adminCount(roster) <= 1) return refuse("LAST_ADMIN");
      return allow("setRole");
    }
    case "remove": {
      if (actorRole !== "ADMIN") return refuse("FORBIDDEN");
      if (change.targetUserId === actorUserId) return refuse("USE_LEAVE");
      const targetRole = roster.get(change.targetUserId);
      if (targetRole === undefined) return allow("none");
      if (targetRole === "ADMIN" && adminCount(roster) <= 1) return refuse("LAST_ADMIN");
      return allow("delete");
    }
    case "leave": {
      if (roster.size <= 1) return refuse("ONLY_MEMBER");
      if (actorRole === "ADMIN" && adminCount(roster) <= 1) return refuse("LAST_ADMIN");
      return allow("delete");
    }
  }
}

export type MemberMenu = {
  canPromote: boolean;
  canDemote: boolean;
  canRemove: boolean;
  canCreateResetLink: boolean;
  isSelf: boolean;
  /** Why "Fjern admin-rollen" is shown disabled (the target is the last admin). */
  demoteBlockedReason: "LAST_ADMIN" | null;
};

/**
 * The '⋯' menu an admin sees for one member, built from
 * decideMembershipChange so UI and server agree. Null for a viewer who is not
 * an admin and for a target who is not a member. canCreateResetLink only says
 * "another member": the server still checks the target's other clubs and
 * logins (canResetMemberPassword).
 */
export function memberMenu(
  viewerUserId: string,
  targetUserId: string,
  roster: Roster,
): MemberMenu | null {
  if (roster.get(viewerUserId) !== "ADMIN") return null;
  const targetRole = roster.get(targetUserId);
  if (targetRole === undefined) return null;

  const isSelf = viewerUserId === targetUserId;
  const promote = decideMembershipChange(
    viewerUserId,
    { kind: "setRole", targetUserId, role: "ADMIN" },
    roster,
  );
  const demote = decideMembershipChange(
    viewerUserId,
    { kind: "setRole", targetUserId, role: "MEMBER" },
    roster,
  );
  const remove = decideMembershipChange(viewerUserId, { kind: "remove", targetUserId }, roster);

  return {
    canPromote: promote.ok && promote.effect === "setRole",
    canDemote: demote.ok && demote.effect === "setRole",
    canRemove: remove.ok && remove.effect === "delete",
    canCreateResetLink: !isSelf,
    isSelf,
    demoteBlockedReason: !demote.ok && demote.reason === "LAST_ADMIN" ? "LAST_ADMIN" : null,
  };
}

/** Why the user cannot leave the club (§7.4, E2, E3), or null when they can. */
export function leaveBlock(userId: string, roster: Roster): "LAST_ADMIN" | "ONLY_MEMBER" | null {
  const decision = decideMembershipChange(userId, { kind: "leave" }, roster);
  if (decision.ok) return null;
  return decision.reason === "LAST_ADMIN" || decision.reason === "ONLY_MEMBER"
    ? decision.reason
    : null;
}

function comparableClubName(value: string): string {
  return cleanSingleLine(value).toLocaleLowerCase("da");
}

/**
 * "Skriv klubbens navn for at bekræfte" (§7.5, D-103): the typed name matches
 * after NUL removal, NFC, collapsed whitespace, trim and Danish lower case.
 * "  drengene &  BAJERE " confirms "Drengene & Bajere"; "" never does.
 */
export function isClubNameConfirmed(clubName: string, typed: string): boolean {
  const confirmation = comparableClubName(typed);
  return confirmation !== "" && confirmation === comparableClubName(clubName);
}
