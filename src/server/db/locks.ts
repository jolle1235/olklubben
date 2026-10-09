import "server-only";

import { Prisma } from "@/generated/prisma/client";

/**
 * Row and advisory locks for round 3's invariants (D-095, D-096, D-102). The
 * ONLY place with raw SQL besides the migrations. Every function runs inside
 * an interactive transaction (`db.$transaction(async (tx) => …)`) and holds
 * its lock until that transaction ends.
 *
 * Lock order, always (deadlock prevention):
 *   club → place-name advisory → place row → event row → memberships
 * (updateEvent is the one documented exception: it locks its event row before
 * the place, which is safe because nothing that locks a place row waits for an
 * event row lock; see src/server/events/mutations.ts.)
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
