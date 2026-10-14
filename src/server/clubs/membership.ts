import "server-only";

import { db, type TransactionClient } from "@/server/db";
import { lockClub, lockClubPollIds, lockOpenPollIds } from "@/server/db/locks";
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
 * §7.5, §9.8; E1–E3, E15, E25; D-102, D-103, D-110, D-130).
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
 * Ends a membership (§7.4, E1). Runs under the club lock. ORDER MATTERS
 * (lock order club → polls → … → memberships, src/server/db/locks.ts):
 *   1. Lock the club's OPEN polls (lockOpenPollIds) BEFORE the membership is
 *      deleted. A vote or a close holds its poll and then reads or locks
 *      memberships; deleting the membership first and then waiting for the
 *      poll would deadlock. It also makes a voter's plain membership read
 *      under the poll lock authoritative (D-130). Postgres re-checks
 *      status = 'OPEN' after a wait, so a poll a concurrent vote has just
 *      closed is left out – its ballots are history.
 *   2. Delete the membership. It waits for transactions that hold it FOR SHARE
 *      (an event being saved with this user as host, lockMemberIds), and the
 *      composite FK cascades the user's place ownerships in this club.
 *   3. Delete the user's hostships on events that have NOT started; started
 *      and past ones stay as history.
 *   4. Delete the user's ballots in exactly those OPEN polls (votes cascade);
 *      ballots in AWAITING_DECISION/CLOSED/CANCELLED polls stay (§7.4).
 *   5. Clear lastActiveClubId when it pointed at this club (E15).
 * Ratings, beers, events, places and created-by references are kept. A poll
 * that is now "all voted" closes on the next Overblik/Kalender/poll view or
 * the cron (no close here, C18).
 */
async function endMembership(
  tx: Tx,
  input: { clubId: string; userId: string; now: Date },
): Promise<void> {
  const { clubId, userId, now } = input;
  const openPollIds = await lockOpenPollIds(tx, clubId);
  await tx.membership.deleteMany({ where: { clubId, userId } });
  await tx.eventHost.deleteMany({
    where: { userId, event: { clubId, startsAt: { gt: now } } },
  });
  if (openPollIds.length > 0) {
    await tx.pollBallot.deleteMany({ where: { userId, pollId: { in: openPollIds } } });
  }
  await tx.user.updateMany({
    where: { id: userId, lastActiveClubId: clubId },
    data: { lastActiveClubId: null },
  });
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

    // Polls first, FOR UPDATE (D-130): no close can add an event between the
    // two deletes below (FOR UPDATE blocks the KEY SHARE of a new
    // events.poll_id), and events.poll_id is RESTRICT.
    await lockClubPollIds(tx, clubId);
    // Events next (defence in depth for events.place_id RESTRICT, and they
    // reference the polls), then the polls (→ options, ballots, votes, tie
    // resolutions) BEFORE the places (poll_options.place_id RESTRICT, D-103).
    await tx.event.deleteMany({ where: { clubId } });
    await tx.poll.deleteMany({ where: { clubId } });
    // Cascades: memberships (→ place_owners), places, beers (→ ratings) and
    // invites; users.last_active_club_id is set to NULL; users are kept.
    await tx.club.delete({ where: { id: clubId } });
    return { ok: true };
  });
}
