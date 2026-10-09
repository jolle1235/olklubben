import { Client } from "pg";

import { pgConfig } from "../../src/server/db/pg-config";
import { testDatabaseUrl } from "../test-env";

/**
 * Direct SQL against the E2E database (olklubben_test, guarded by test-env.ts)
 * for things the UI cannot do yet in round 1: removing a member, changing a
 * role, ageing a reset token. Each call opens and closes its own connection,
 * so tests stay independent of each other. Sessions run in UTC like the app's
 * (pgConfig, F-012).
 */
export async function sql<Row extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<Row[]> {
  const client = new Client(pgConfig(testDatabaseUrl));
  await client.connect();
  try {
    const result = await client.query<Row>(text, params);
    return result.rows;
  } finally {
    await client.end();
  }
}

export async function userIdByEmail(email: string): Promise<string> {
  const [row] = await sql<{ id: string }>("SELECT id FROM users WHERE email = $1", [
    email.toLowerCase(),
  ]);
  if (!row) throw new Error(`E2E: ingen bruger med email ${email}`);
  return row.id;
}

/** The user's User.lastActiveClubId (SPEC §10.3). */
export async function lastActiveClubId(email: string): Promise<string | null> {
  const [row] = await sql<{ last_active_club_id: string | null }>(
    "SELECT last_active_club_id FROM users WHERE email = $1",
    [email.toLowerCase()],
  );
  if (!row) throw new Error(`E2E: ingen bruger med email ${email}`);
  return row.last_active_club_id;
}

/** Logs the user out everywhere in the database; the browser keeps a now stale cookie. */
export async function deleteSessions(email: string): Promise<void> {
  await sql("DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = $1)", [
    email.toLowerCase(),
  ]);
}

/** Ends a membership, as round 3's "fjern medlem" will (E15, E16). */
export async function deleteMembership(email: string, clubId: string): Promise<void> {
  await sql(
    "DELETE FROM memberships WHERE club_id = $1 AND user_id = (SELECT id FROM users WHERE email = $2)",
    [clubId, email.toLowerCase()],
  );
}

export async function setRole(email: string, clubId: string, role: "ADMIN" | "MEMBER") {
  await sql(
    `UPDATE memberships SET role = $3::club_role
     WHERE club_id = $1 AND user_id = (SELECT id FROM users WHERE email = $2)`,
    [clubId, email.toLowerCase(), role],
  );
}

/**
 * Makes every password reset token of the user expired. A full day in the
 * past, so the result does not depend on the database session's time zone.
 */
export async function expireResetTokens(email: string): Promise<number> {
  const userId = await userIdByEmail(email);
  const rows = await sql(
    "UPDATE verifications SET expires_at = now() - interval '1 day' WHERE value = $1 RETURNING id",
    [userId],
  );
  return rows.length;
}

/** How many verification rows (reset tokens) point at the user. */
export async function countResetTokens(email: string): Promise<number> {
  const userId = await userIdByEmail(email);
  const [row] = await sql<{ count: number }>(
    "SELECT count(*)::int AS count FROM verifications WHERE value = $1",
    [userId],
  );
  return row?.count ?? 0;
}

/**
 * Gives the user a Google login next to the password (like E19 account
 * linking), without going through Google.
 */
export async function addGoogleAccount(email: string): Promise<void> {
  const userId = await userIdByEmail(email);
  await sql(
    `INSERT INTO accounts (id, account_id, provider_id, user_id, updated_at)
     VALUES (gen_random_uuid()::text, $1, 'google', $2, now())`,
    [`google-${userId}`, userId],
  );
}

/** The user's newest session row (D-030 sliding sessions). */
export async function latestSession(
  email: string,
): Promise<{ id: string; expiresInSeconds: number; updatedSecondsAgo: number }> {
  const userId = await userIdByEmail(email);
  const [row] = await sql<{ id: string; expires_in: number; updated_ago: number }>(
    `SELECT id,
            extract(epoch FROM expires_at - now())::float8 AS expires_in,
            extract(epoch FROM now() - updated_at)::float8 AS updated_ago
     FROM sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId],
  );
  if (!row) throw new Error(`E2E: ingen session for ${email}`);
  return { id: row.id, expiresInSeconds: row.expires_in, updatedSecondsAgo: row.updated_ago };
}

/** Makes a session look as if it was last refreshed two days ago (58 of 60 days left). */
export async function ageSession(sessionId: string): Promise<void> {
  await sql(
    `UPDATE sessions
     SET expires_at = now() + interval '58 days', updated_at = now() - interval '2 days'
     WHERE id = $1`,
    [sessionId],
  );
}

/**
 * Inserts an event directly (round 2), e.g. to test club isolation without the
 * event form. Times are UTC instants. Returns the new id (a UUID; the app's
 * ids are UUIDv7 from Prisma, but any UUID passes isValidId).
 */
export async function insertEvent(input: {
  clubId: string;
  createdByEmail: string;
  title: string;
  startsAt: Date;
  endsAt?: Date | null;
  locationText?: string;
}): Promise<string> {
  const [row] = await sql<{ id: string }>(
    `INSERT INTO events (id, club_id, title, starts_at, ends_at, location_text, created_by_id, updated_at)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, (SELECT id FROM users WHERE email = $6), now())
     RETURNING id`,
    [
      input.clubId,
      input.title,
      input.startsAt,
      input.endsAt ?? null,
      input.locationText ?? "Hos E2E",
      input.createdByEmail.toLowerCase(),
    ],
  );
  if (!row) throw new Error("E2E: kunne ikke oprette event");
  return row.id;
}

/** Inserts a beer directly (round 2). `abv` like 5.2. Returns the new id. */
export async function insertBeer(input: {
  clubId: string;
  createdByEmail: string;
  name: string;
  abv?: number;
  eventId?: string | null;
}): Promise<string> {
  const [row] = await sql<{ id: string }>(
    `INSERT INTO beers (id, club_id, name, abv, event_id, created_by_id, updated_at)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, (SELECT id FROM users WHERE email = $5), now())
     RETURNING id`,
    [
      input.clubId,
      input.name,
      (input.abv ?? 5).toFixed(1),
      input.eventId ?? null,
      input.createdByEmail.toLowerCase(),
    ],
  );
  if (!row) throw new Error("E2E: kunne ikke oprette øl");
  return row.id;
}

/** Sets a member's rating directly (round 2). `value` is the stored 2..10 (half points). */
export async function insertRating(input: {
  beerId: string;
  email: string;
  value: number;
}): Promise<void> {
  await sql(
    `INSERT INTO beer_ratings (id, beer_id, user_id, value, updated_at)
     VALUES (gen_random_uuid()::text, $1, (SELECT id FROM users WHERE email = $2), $3, now())
     ON CONFLICT (beer_id, user_id) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [input.beerId, input.email.toLowerCase(), input.value],
  );
}

/** How many ratings the beer has in the database. */
export async function countRatings(beerId: string): Promise<number> {
  const [row] = await sql<{ count: number }>(
    "SELECT count(*)::int AS count FROM beer_ratings WHERE beer_id = $1",
    [beerId],
  );
  return row?.count ?? 0;
}
