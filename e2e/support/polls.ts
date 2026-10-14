import { sql } from "./db";

/**
 * Direct SQL for the round-4 poll E2E specs (SPEC §9.7): set up a poll or a
 * ballot without the forms, travel in time (expirePoll) and read the result.
 * Written by the foundation; the specs are written but NOT run in round 4
 * (Jesper, 2026-10-14, TG-053).
 *
 * The rows satisfy the database's CHECKs and composite FKs exactly like the
 * app's writes (polls_lifecycle_*, poll_options_category_check, votes in the
 * option's category). Ids are random UUIDs (any UUID passes isValidId).
 */

export type InsertPollInput = {
  clubId: string;
  creatorEmail: string;
  title: string;
  theme?: string | null;
  description?: string | null;
  /** UTC instants of the date options. */
  dates: Date[];
  /** Places of the club (insertPlace / placeIdByName). */
  placeIds: string[];
  deadline: Date;
  /** Default OPEN. AWAITING_DECISION/CLOSED get closeReason DEADLINE and closedAt now. */
  status?: "OPEN" | "AWAITING_DECISION" | "CLOSED" | "CANCELLED";
};

export type InsertedPoll = {
  pollId: string;
  /** In the order of `dates`. */
  dateOptionIds: string[];
  /** In the order of `placeIds`. */
  placeOptionIds: string[];
};

export async function insertPoll(input: InsertPollInput): Promise<InsertedPoll> {
  const status = input.status ?? "OPEN";
  const decided = status === "AWAITING_DECISION" || status === "CLOSED";
  const cancelled = status === "CANCELLED";
  const [poll] = await sql<{ id: string }>(
    `INSERT INTO polls (id, club_id, title, theme, description, deadline, status,
                        close_reason, closed_at, cancelled_at, cancelled_by_id,
                        created_by_id, updated_at)
     SELECT gen_random_uuid()::text, $1, $2, $3, $4, $5, $6::poll_status,
            CASE WHEN $7::boolean THEN 'DEADLINE'::poll_close_reason END,
            CASE WHEN $7::boolean THEN now() END,
            CASE WHEN $8::boolean THEN now() END,
            CASE WHEN $8::boolean THEN u.id END,
            u.id, now()
     FROM users u WHERE u.email = $9
     RETURNING id`,
    [
      input.clubId,
      input.title,
      input.theme ?? null,
      input.description ?? null,
      input.deadline,
      status,
      decided,
      cancelled,
      input.creatorEmail.toLowerCase(),
    ],
  );
  if (!poll) throw new Error(`E2E: ingen bruger med email ${input.creatorEmail}`);

  const dateOptionIds: string[] = [];
  for (const startsAt of input.dates) {
    const [row] = await sql<{ id: string }>(
      `INSERT INTO poll_options (id, poll_id, club_id, category, starts_at)
       VALUES (gen_random_uuid()::text, $1, $2, 'DATE', $3) RETURNING id`,
      [poll.id, input.clubId, startsAt],
    );
    if (row) dateOptionIds.push(row.id);
  }
  const placeOptionIds: string[] = [];
  for (const placeId of input.placeIds) {
    const [row] = await sql<{ id: string }>(
      `INSERT INTO poll_options (id, poll_id, club_id, category, place_id)
       VALUES (gen_random_uuid()::text, $1, $2, 'PLACE', $3) RETURNING id`,
      [poll.id, input.clubId, placeId],
    );
    if (row) placeOptionIds.push(row.id);
  }
  return { pollId: poll.id, dateOptionIds, placeOptionIds };
}

/**
 * A member's ballot with the given ticks (the categories are read from the
 * options). Only complete ballots are ever stored by the app (D-134): pass a
 * complete one. Replaces an existing ballot of the user.
 */
export async function insertBallot(input: {
  pollId: string;
  email: string;
  optionIds: string[];
  noDateWorks?: boolean;
}): Promise<string> {
  await sql(
    `DELETE FROM poll_ballots
     WHERE poll_id = $1 AND user_id = (SELECT id FROM users WHERE email = $2)`,
    [input.pollId, input.email.toLowerCase()],
  );
  const [ballot] = await sql<{ id: string }>(
    `INSERT INTO poll_ballots (id, poll_id, user_id, no_date_works, updated_at)
     SELECT gen_random_uuid()::text, $1, u.id, $3, now() FROM users u WHERE u.email = $2
     RETURNING id`,
    [input.pollId, input.email.toLowerCase(), input.noDateWorks ?? false],
  );
  if (!ballot) throw new Error(`E2E: ingen bruger med email ${input.email}`);
  if (input.optionIds.length > 0) {
    await sql(
      `INSERT INTO poll_votes (ballot_id, poll_id, option_id, category)
       SELECT $1, o.poll_id, o.id, o.category FROM poll_options o
       WHERE o.poll_id = $2 AND o.id = ANY($3::text[])`,
      [ballot.id, input.pollId, input.optionIds],
    );
  }
  return ballot.id;
}

/**
 * Moves the deadline into the past (default: one minute ago), so the next
 * Overblik / Kalender / poll page view closes the poll lazily (E6, D-131).
 */
export async function expirePoll(pollId: string, msAgo = 60_000): Promise<void> {
  await sql("UPDATE polls SET deadline = $2 WHERE id = $1", [pollId, new Date(Date.now() - msAgo)]);
}

/** The poll's status and why/when voting ended. */
export async function pollStatus(pollId: string): Promise<{
  status: string;
  closeReason: string | null;
  closedAt: Date | null;
}> {
  const [row] = await sql<{ status: string; close_reason: string | null; closed_at: Date | null }>(
    "SELECT status::text AS status, close_reason::text AS close_reason, closed_at FROM polls WHERE id = $1",
    [pollId],
  );
  if (!row) throw new Error(`E2E: ingen afstemning ${pollId}`);
  return { status: row.status, closeReason: row.close_reason, closedAt: row.closed_at };
}

/** The id of the event the poll created (events.poll_id is UNIQUE), or null. */
export async function eventIdByPollId(pollId: string): Promise<string | null> {
  const [row] = await sql<{ id: string }>("SELECT id FROM events WHERE poll_id = $1", [pollId]);
  return row?.id ?? null;
}

/** The newest poll of the club (after creating one through the form). */
export async function latestPollId(clubId: string): Promise<string | null> {
  const [row] = await sql<{ id: string }>(
    "SELECT id FROM polls WHERE club_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1",
    [clubId],
  );
  return row?.id ?? null;
}

/** "/c/<clubId>/polls/<pollId>" (mirrors src/lib/routes.ts pollHref). */
export function pollPath(clubId: string, pollId: string): string {
  return `/c/${clubId}/polls/${pollId}`;
}
