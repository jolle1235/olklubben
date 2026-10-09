import "server-only";

import { db, type TransactionClient } from "@/server/db";
import { lockClub } from "@/server/db/locks";
import {
  decideMembershipChange,
  isClubNameConfirmed,
  type MembershipChange,
  type MembershipDecision,
  type Roster,
} from "@/server/domain/clubs/membership-rules";
import type { ClubRole } from "@/server/domain/clubs/permissions";

/**
 * Membership administration, club info and deleting the club (SPEC §5, §7.4,
 * §7.5, §9.8; E1–E3, E15, E25; D-102, D-103, D-110).
 *
 * Every function runs in ONE transaction that starts by locking the club's row
 * (lockClub, FOR NO KEY UPDATE) – a per-club mutex – and then reads the
 * actor's role and the whole roster under that lock. So two admins who demote
 * or remove each other at the same time are decided one after the other, and
 * the club always keeps an admin (E25). Replaces §11's "lock the admin
 * memberships".
 *
 * Authorization: the actor's role is re-read under the lock (a Server Action's
 * earlier requireMembership may be stale). The rules themselves live in
 * src/server/domain/clubs/membership-rules.ts.
 */

/** The club no longer exists (deleted meanwhile). The action answers 404. */
export class ClubGoneError extends Error {
  readonly code = "CLUB_GONE";

  constructor() {
    super("Klubben findes ikke længere.");
    this.name = "ClubGoneError";
  }
}

type Tx = TransactionClient;

async function readRoster(tx: Tx, clubId: string): Promise<Roster> {
  const rows = await tx.membership.findMany({
    where: { clubId },
    select: { userId: true, role: true },
  });
  return new Map(rows.map((row) => [row.userId, row.role]));
}

/** Runs `work` in a transaction holding the club lock, with the roster read under it. */
async function withClubLock<T>(
  clubId: string,
  work: (tx: Tx, roster: Roster) => Promise<T>,
): Promise<T> {
  return db.$transaction(async (tx) => {
    if (!(await lockClub(tx, clubId))) throw new ClubGoneError();
    return work(tx, await readRoster(tx, clubId));
  });
}

/**
 * Ends a membership (§7.4, E1). ORDER MATTERS:
 *   1. Delete the membership. It waits for transactions that hold it FOR SHARE
 *      (an event being saved with this user as host, lockMemberIds), and the
 *      composite FK cascades the user's place ownerships in this club.
 *   2. Delete the user's hostships on events that have NOT started; started
 *      and past ones stay as history.
 *   3. Clear lastActiveClubId when it pointed at this club (E15).
 * Ratings, beers, events, places and created-by references are kept.
 */
async function endMembership(
  tx: Tx,
  input: { clubId: string; userId: string; now: Date },
): Promise<void> {
  const { clubId, userId, now } = input;
  await tx.membership.deleteMany({ where: { clubId, userId } });
  await tx.eventHost.deleteMany({
    where: { userId, event: { clubId, startsAt: { gt: now } } },
  });
  await tx.user.updateMany({
    where: { id: userId, lastActiveClubId: clubId },
    data: { lastActiveClubId: null },
  });
  // ROUND 4 HOOK: delete the user's ballots in this club's OPEN polls (§7.4).
}

/** Applies an allowed decision to the roster. */
async function apply(
  tx: Tx,
  input: { clubId: string; userId: string; change: MembershipChange; now: Date },
  decision: MembershipDecision,
): Promise<void> {
  if (!decision.ok) return;
  const { clubId, userId, change, now } = input;
  if (decision.effect === "setRole" && change.kind === "setRole") {
    await tx.membership.updateMany({
      where: { clubId, userId: change.targetUserId },
      data: { role: change.role },
    });
  } else if (decision.effect === "delete") {
    await endMembership(tx, { clubId, userId, now });
  }
}

/** "Gør til admin" / "Fjern admin-rollen" (also on yourself while another admin stays). */
export async function changeMemberRole(input: {
  clubId: string;
  actorUserId: string;
  targetUserId: string;
  role: ClubRole;
}): Promise<MembershipDecision> {
  const { clubId, actorUserId, targetUserId, role } = input;
  const change: MembershipChange = { kind: "setRole", targetUserId, role };
  return withClubLock(clubId, async (tx, roster) => {
    const decision = decideMembershipChange(actorUserId, change, roster);
    await apply(tx, { clubId, userId: targetUserId, change, now: new Date() }, decision);
    return decision;
  });
}

/** "Fjern fra klubben" (admins). Removing someone who already left is a no-op. */
export async function removeMember(input: {
  clubId: string;
  actorUserId: string;
  targetUserId: string;
  now: Date;
}): Promise<MembershipDecision> {
  const { clubId, actorUserId, targetUserId, now } = input;
  const change: MembershipChange = { kind: "remove", targetUserId };
  return withClubLock(clubId, async (tx, roster) => {
    const decision = decideMembershipChange(actorUserId, change, roster);
    await apply(tx, { clubId, userId: targetUserId, change, now }, decision);
    return decision;
  });
}

/** "Forlad klubben": refused for the last admin (E2) and the only member (E3). */
export async function leaveClub(input: {
  clubId: string;
  userId: string;
  now: Date;
}): Promise<MembershipDecision> {
  const { clubId, userId, now } = input;
  const change: MembershipChange = { kind: "leave" };
  return withClubLock(clubId, async (tx, roster) => {
    const decision = decideMembershipChange(userId, change, roster);
    await apply(tx, { clubId, userId, change, now }, decision);
    return decision;
  });
}

/**
 * "Rediger klubinfo" (admins, D-110). Name and description are already
 * cleaned by updateClubInfoSchema. The actor's role is re-read under the lock.
 */
export async function updateClubInfo(input: {
  clubId: string;
  actorUserId: string;
  name: string;
  description: string | null;
}): Promise<{ ok: true } | { ok: false; reason: "FORBIDDEN" }> {
  const { clubId, actorUserId, name, description } = input;
  return withClubLock(clubId, async (tx, roster) => {
    if (roster.get(actorUserId) !== "ADMIN") return { ok: false, reason: "FORBIDDEN" };
    await tx.club.update({ where: { id: clubId }, data: { name, description } });
    return { ok: true };
  });
}

/**
 * "Slet klubben" (admins, §7.5, D-103): the typed name must match the name
 * read under the lock (isClubNameConfirmed). Everything in the club goes;
 * the members' accounts stay.
 */
export async function deleteClub(input: {
  clubId: string;
  actorUserId: string;
  confirmName: string;
}): Promise<{ ok: true } | { ok: false; reason: "FORBIDDEN" | "NAME_MISMATCH" }> {
  const { clubId, actorUserId, confirmName } = input;
  return withClubLock(clubId, async (tx, roster) => {
    if (roster.get(actorUserId) !== "ADMIN") return { ok: false, reason: "FORBIDDEN" };
    const club = await tx.club.findUniqueOrThrow({ where: { id: clubId }, select: { name: true } });
    if (!isClubNameConfirmed(club.name, confirmName)) return { ok: false, reason: "NAME_MISMATCH" };

    // Defence in depth: events go first, although deleting the club with
    // events.place_id RESTRICT is verified to work (integration test).
    await tx.event.deleteMany({ where: { clubId } });
    // ROUND 4: delete the club's polls before its places (PollOption → Place RESTRICT).
    // Cascades: memberships (→ place_owners), places, beers (→ ratings) and
    // invites; users.last_active_club_id is set to NULL; users are kept.
    await tx.club.delete({ where: { id: clubId } });
    return { ok: true };
  });
}
