import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { FeedbackStatus } from "@/server/domain/feedback/status";
import type { PollStatus } from "@/server/domain/polls/options";

/**
 * Row and advisory locks for round 3's and round 4's invariants (D-095, D-096,
 * D-102, D-130) and feedback moderation (D-145). The ONLY place with raw SQL
 * for locks (other raw SQL: the rate limiter's upsert and the feedback vote's
 * guarded INSERT … SELECT in src/server/feedback/mutations.ts). Every
 * function runs inside an interactive transaction (`db.$transaction(async (tx)
 * => …)`) and holds its lock until that transaction ends.
 *
 * Lock order, always (deadlock prevention):
 *   club → polls (by id) → place-name advisory → place rows (by id) → event row
 *   → memberships
 * (updateEvent is the one documented exception: it locks its event row before
 * the place, which is safe because nothing that locks a place row waits for an
 * event row lock; see src/server/events/mutations.ts.)
 *
 * Polls (round 4): EVERY writer of a poll – a vote, a close, choosing the
 * winner, cancelling, editing – holds lockPoll (FOR NO KEY UPDATE) first, so
 * they run one after the other per poll. Never take a weaker lock and upgrade.
 * A voter's membership is then read PLAINLY under the poll lock: that is
 * authoritative because the only path that deletes a membership while the club
 * exists (endMembership, src/server/clubs/membership.ts) locks the club's OPEN
 * polls (lockOpenPollIds) BEFORE it deletes the membership. Any future path
 * that deletes a membership must do the same.
 *
 * Never catch a Prisma error and keep using the same transaction: Postgres
 * aborts it. Check under these locks first instead.
 *
 * Every lookup is scoped by club_id (§4.4), so another club's id is "not found".
 */

type Tx = Prisma.TransactionClient;

/**
 * The club's row as a per-club mutex for membership changes (last-admin rule,
 * E25) and deleteClub. FOR NO KEY UPDATE: it serializes those writers but does
 * not block inserts that only need the club as an FK target (KEY SHARE), like
 * new events or beers. False when the club is gone.
 */
export async function lockClub(tx: Tx, clubId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM clubs WHERE id = ${clubId} FOR NO KEY UPDATE`;
  return rows.length === 1;
}

export type LockedPlace = { id: string; archivedAt: Date | null; createdById: string };

/**
 * One place of the club, locked. SHARE: it cannot be archived, deleted or
 * restored until the transaction ends (choosing it for an event). UPDATE:
 * exclusive, and it also blocks new events from referencing it (their FK
 * check needs KEY SHARE), so a usage count stays exact (removePlace).
 * Null for an unknown place or another club's place.
 */
export async function lockPlace(
  tx: Tx,
  clubId: string,
  placeId: string,
  mode: "SHARE" | "UPDATE",
): Promise<LockedPlace | null> {
  // Two literal templates: the lock mode is never a parameter.
  const rows =
    mode === "SHARE"
      ? await tx.$queryRaw<LockedPlace[]>`
          SELECT id, archived_at AS "archivedAt", created_by_id AS "createdById"
          FROM places WHERE id = ${placeId} AND club_id = ${clubId} FOR SHARE`
      : await tx.$queryRaw<LockedPlace[]>`
          SELECT id, archived_at AS "archivedAt", created_by_id AS "createdById"
          FROM places WHERE id = ${placeId} AND club_id = ${clubId} FOR UPDATE`;
  return rows[0] ?? null;
}

export type LockedEvent = { id: string; placeId: string; createdById: string };

/** One event of the club, locked FOR UPDATE (editing it). Null when not found. */
export async function lockEvent(
  tx: Tx,
  clubId: string,
  eventId: string,
): Promise<LockedEvent | null> {
  const rows = await tx.$queryRaw<LockedEvent[]>`
    SELECT id, place_id AS "placeId", created_by_id AS "createdById"
    FROM events WHERE id = ${eventId} AND club_id = ${clubId} FOR UPDATE`;
  return rows[0] ?? null;
}

/**
 * Which of the users are members of the club, with their memberships locked
 * FOR SHARE: a concurrent leave or removal (which DELETEs the membership)
 * waits until this transaction ends, so a new host or owner is a member when
 * the row is written (D-098). A membership deleted just before is simply not
 * returned. Sorted by user id, so two transactions lock in the same order.
 * Empty input → empty set, no query.
 */
export async function lockMemberIds(
  tx: Tx,
  clubId: string,
  userIds: readonly string[],
): Promise<Set<string>> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return new Set();
  const rows = await tx.$queryRaw<{ userId: string }[]>`
    SELECT user_id AS "userId" FROM memberships
    WHERE club_id = ${clubId} AND user_id IN (${Prisma.join(unique)})
    ORDER BY user_id
    FOR SHARE`;
  return new Set(rows.map((row) => row.userId));
}

/**
 * Serializes every write that can change which ACTIVE place names exist in
 * the club (create, rename, restore, find-or-create from the event form), so
 * the "same name already exists" pre-check is exact (D-095). The partial
 * unique index places_club_id_name_key_active_key is only the backstop.
 * $executeRaw, not $queryRaw: Prisma cannot deserialize the `void` result.
 */
export async function lockPlaceNames(tx: Tx, clubId: string): Promise<void> {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtextextended('olk:place-names:' || ${clubId}::text, 0))`;
}

export type LockedPoll = {
  id: string;
  status: PollStatus;
  deadline: Date;
  createdById: string;
  title: string;
  theme: string | null;
  description: string | null;
  closedAt: Date | null;
};

/**
 * One poll of the club, FOR NO KEY UPDATE: serializes EVERY poll writer (vote,
 * close, tie, cancel, edit) without blocking the FK inserts that only need the
 * poll as a target (KEY SHARE: a new event's poll_id, a new ballot's poll_id).
 * Null when the poll is unknown or in another club.
 */
export async function lockPoll(tx: Tx, clubId: string, pollId: string): Promise<LockedPoll | null> {
  const rows = await tx.$queryRaw<LockedPoll[]>`
    SELECT id, status::text AS status, deadline, created_by_id AS "createdById",
           title, theme, description, closed_at AS "closedAt"
    FROM polls WHERE id = ${pollId} AND club_id = ${clubId}
    FOR NO KEY UPDATE`;
  return rows[0] ?? null;
}

/**
 * The club's OPEN polls, locked FOR NO KEY UPDATE in id order (endMembership:
 * before the membership is deleted). After waiting for a lock, Postgres
 * re-checks status = 'OPEN' (READ COMMITTED), so a poll that a concurrent vote
 * has just closed is left out, and its ballots stay as history (§7.4).
 */
export async function lockOpenPollIds(tx: Tx, clubId: string): Promise<string[]> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM polls WHERE club_id = ${clubId} AND status = 'OPEN'
    ORDER BY id
    FOR NO KEY UPDATE`;
  return rows.map((row) => row.id);
}

/**
 * All of the club's polls, FOR UPDATE in id order (deleteClub). FOR UPDATE
 * also blocks the KEY SHARE that a new events.poll_id reference needs, so no
 * close can add an event between deleting the events and deleting the polls.
 */
export async function lockClubPollIds(tx: Tx, clubId: string): Promise<string[]> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM polls WHERE club_id = ${clubId}
    ORDER BY id
    FOR UPDATE`;
  return rows.map((row) => row.id);
}

export type LockedFeedback = { id: string; status: FeedbackStatus };

/**
 * Feedback reports (app-wide, no club), FOR NO KEY UPDATE in id order
 * (moderateFeedback: the report and the original it is marked a duplicate
 * of). Holding the original's lock means it can be neither deleted (DELETE
 * needs FOR UPDATE) nor turned into a duplicate itself until the transaction
 * ends, so "the original exists and is not a duplicate" stays true (D-145).
 * Unknown ids are simply missing from the result.
 */
export async function lockFeedbackRows(tx: Tx, ids: readonly string[]): Promise<LockedFeedback[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  return tx.$queryRaw<LockedFeedback[]>`
    SELECT id, status::text AS status FROM feedback
    WHERE id = ANY(${unique}::text[])
    ORDER BY id
    FOR NO KEY UPDATE`;
}
