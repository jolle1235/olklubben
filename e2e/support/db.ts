import { Client } from "pg";

import { pgConfig } from "../../src/server/db/pg-config";
import { cleanPlaceName, placeNameKey } from "../../src/server/domain/places/name";
import { cleanSongText } from "../../src/server/domain/songs/song-text";
import { cleanSongTitle, songTitleKey } from "../../src/server/domain/songs/title";
import { testDatabaseUrl } from "../test-env";

/**
 * Direct SQL against the E2E database (olklubben_test, guarded by test-env.ts)
 * for setup the UI cannot do (quickly): removing a member, changing a role,
 * ageing a reset token or a session, inserting events, places, beers, ratings
 * and songs. Each call opens and closes its own connection,
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
 * Makes a session look as if it was created `minutes` ago. "Tilføj password"
 * needs a login under 10 minutes old (D-152); ageSession does not touch
 * created_at.
 */
export async function backdateSessionCreatedAt(sessionId: string, minutes: number): Promise<void> {
  await sql(
    "UPDATE sessions SET created_at = now() - make_interval(mins => $2::int) WHERE id = $1",
    [sessionId, minutes],
  );
}

/**
 * Inserts a place directly (round 3), with optional owners (who must be
 * members: the composite FK refuses anyone else) and optionally archived.
 * The name is cleaned and keyed like the app (placeNameKey). Returns its id.
 */
export async function insertPlace(input: {
  clubId: string;
  name: string;
  createdByEmail: string;
  address?: string | null;
  ownerEmails?: string[];
  archived?: boolean;
}): Promise<string> {
  const name = cleanPlaceName(input.name);
  const [row] = await sql<{ id: string }>(
    `INSERT INTO places (id, club_id, name, name_key, address, created_by_id, archived_at, updated_at)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, (SELECT id FROM users WHERE email = $5),
             CASE WHEN $6::boolean THEN now() END, now())
     RETURNING id`,
    [
      input.clubId,
      name,
      placeNameKey(name),
      input.address ?? null,
      input.createdByEmail.toLowerCase(),
      input.archived ?? false,
    ],
  );
  if (!row) throw new Error("E2E: kunne ikke oprette sted");
  for (const email of input.ownerEmails ?? []) await addPlaceOwner(row.id, email);
  return row.id;
}

/** Makes a member an owner of a place ("Det er mit sted"). */
export async function addPlaceOwner(placeId: string, email: string): Promise<void> {
  await sql(
    `INSERT INTO place_owners (place_id, club_id, user_id)
     SELECT p.id, p.club_id, u.id FROM places p, users u WHERE p.id = $1 AND u.email = $2
     ON CONFLICT DO NOTHING`,
    [placeId, email.toLowerCase()],
  );
}

/** The id of the club's ACTIVE place with this name (same key as the app), or null. */
export async function placeIdByName(clubId: string, name: string): Promise<string | null> {
  const [row] = await sql<{ id: string }>(
    "SELECT id FROM places WHERE club_id = $1 AND name_key = $2 AND archived_at IS NULL",
    [clubId, placeNameKey(name)],
  );
  return row?.id ?? null;
}

/** Sets or clears a user's global nickname (D-105). */
export async function setNickname(email: string, nickname: string | null): Promise<void> {
  await sql("UPDATE users SET nickname = $2 WHERE email = $1", [email.toLowerCase(), nickname]);
}

/**
 * Inserts an event directly, e.g. to test club isolation without the event
 * form. Times are UTC instants. The place is found by name among the club's
 * active places (like "＋ Nyt sted") or created; `locationText` is the round-2
 * alias of `placeName`. Hosts: `hostEmails`, else the creator (D-098).
 * Returns the new id (a UUID; the app's ids are UUIDv7 from Prisma, but any
 * UUID passes isValidId).
 */
export async function insertEvent(input: {
  clubId: string;
  createdByEmail: string;
  title: string;
  startsAt: Date;
  endsAt?: Date | null;
  placeName?: string;
  /** @deprecated Round-2 name for placeName. */
  locationText?: string;
  hostEmails?: string[];
}): Promise<string> {
  const placeName = input.placeName ?? input.locationText ?? "Hos E2E";
  const placeId =
    (await placeIdByName(input.clubId, placeName)) ??
    (await insertPlace({
      clubId: input.clubId,
      name: placeName,
      createdByEmail: input.createdByEmail,
    }));
  const [row] = await sql<{ id: string }>(
    `INSERT INTO events (id, club_id, title, starts_at, ends_at, place_id, created_by_id, updated_at)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, (SELECT id FROM users WHERE email = $6), now())
     RETURNING id`,
    [
      input.clubId,
      input.title,
      input.startsAt,
      input.endsAt ?? null,
      placeId,
      input.createdByEmail.toLowerCase(),
    ],
  );
  if (!row) throw new Error("E2E: kunne ikke oprette event");
  const hostEmails = input.hostEmails?.length ? input.hostEmails : [input.createdByEmail];
  await sql(
    `INSERT INTO event_hosts (event_id, user_id)
     SELECT $1, id FROM users WHERE email = ANY($2::text[])
     ON CONFLICT DO NOTHING`,
    [row.id, hostEmails.map((email) => email.toLowerCase())],
  );
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

/**
 * Inserts a song directly (songbook, SPEC §9.6), as the app would store it:
 * title cleaned with its title key, body cleaned with cleanSongText (leading
 * spaces kept). SYNTHETIC songs only – never real lyrics. Returns the new id.
 */
export async function insertSong(input: {
  clubId: string;
  title: string;
  /** The song-text format: lyrics, chord lines, [Afsnit], blank line = new stanza. */
  body: string;
  artist?: string | null;
  melody?: string | null;
  createdByEmail: string;
}): Promise<string> {
  const title = cleanSongTitle(input.title);
  const [row] = await sql<{ id: string }>(
    `INSERT INTO songs (id, club_id, title, title_key, artist, melody, body, created_by_id, updated_at)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, (SELECT id FROM users WHERE email = $7), now())
     RETURNING id`,
    [
      input.clubId,
      title,
      songTitleKey(title),
      input.artist ?? null,
      input.melody ?? null,
      cleanSongText(input.body),
      input.createdByEmail.toLowerCase(),
    ],
  );
  if (!row) throw new Error("E2E: kunne ikke oprette sang");
  return row.id;
}
