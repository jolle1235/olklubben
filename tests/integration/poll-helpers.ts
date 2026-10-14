import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";

import type { ClubRole } from "@/generated/prisma/enums";
import { createClubWithAdmin } from "@/server/clubs/mutations";
import { db } from "@/server/db";
import { placeNameKey } from "@/server/domain/places/name";
import type { PollStatus } from "@/server/domain/polls/options";

/**
 * Helpers for the round-4 poll integration tests (round4-*.itest.ts). They
 * write straight to the itest database (no Better Auth, no sessions), so the
 * concurrency loops stay fast. For Server Action tests use ./helpers
 * (createUser + setActor) and these for the poll rows.
 */

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
/** Rounds per concurrency loop (like round3-data). */
export const LOOPS = 12;

/** Starts `run` 0–5 ms late, so a race loop hits both orderings (not just the faster call first). */
export async function staggered<T>(round: number, run: () => Promise<T>): Promise<T> {
  await sleep(round % 6);
  return run();
}

/** Resolves to the value or the error, never rejects. */
export async function settle<T>(
  promise: Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> {
  try {
    return { ok: true, value: await promise };
  } catch (error) {
    return { ok: false, error };
  }
}

export type Person = { id: string; name: string };

/** A user written directly (no password, no session). */
export async function person(name: string): Promise<Person> {
  return db.user.create({
    data: { name, email: `r4-${randomUUID()}@example.test` },
    select: { id: true, name: true },
  });
}

/** A club with `admin` as its admin and the given members. Returns the club id. */
export async function clubWith(
  admin: Person,
  members: [Person, ClubRole][] = [],
  name = "R4-klub",
): Promise<string> {
  const { clubId } = await createClubWithAdmin({ userId: admin.id, name });
  for (const [member, role] of members) {
    await db.membership.create({ data: { clubId, userId: member.id, role } });
  }
  return clubId;
}

/** A place in the club, written directly. Owners must be members. */
export async function place(
  clubId: string,
  creator: Person,
  name: string,
  options: { ownerIds?: string[]; archived?: boolean } = {},
): Promise<string> {
  const row = await db.place.create({
    data: {
      clubId,
      createdById: creator.id,
      name,
      nameKey: placeNameKey(name),
      archivedAt: options.archived ? new Date() : null,
    },
    select: { id: true },
  });
  if (options.ownerIds?.length) {
    await db.placeOwner.createMany({
      data: options.ownerIds.map((userId) => ({ placeId: row.id, clubId, userId })),
    });
  }
  return row.id;
}

export type InsertedPoll = {
  pollId: string;
  /** In the order of `dates`. */
  dateOptionIds: string[];
  /** In the order of `placeIds`. */
  placeOptionIds: string[];
};

/**
 * A poll written directly (bypasses createPoll's checks, so tests can build
 * any state). `status` other than OPEN also sets the lifecycle columns the
 * CHECKs require (closeReason DEADLINE, closedAt now; CANCELLED: cancelled
 * by the creator).
 */
export async function insertPoll(input: {
  clubId: string;
  createdById: string;
  title?: string;
  theme?: string | null;
  description?: string | null;
  dates: Date[];
  placeIds: string[];
  deadline: Date;
  status?: PollStatus;
}): Promise<InsertedPoll> {
  const status = input.status ?? "OPEN";
  const now = new Date();
  const poll = await db.poll.create({
    data: {
      clubId: input.clubId,
      createdById: input.createdById,
      title: input.title ?? "Ølsmagning i test",
      theme: input.theme ?? null,
      description: input.description ?? null,
      deadline: input.deadline,
      status,
      ...(status === "AWAITING_DECISION" || status === "CLOSED"
        ? { closeReason: "DEADLINE" as const, closedAt: now }
        : {}),
      ...(status === "CANCELLED" ? { cancelledAt: now, cancelledById: input.createdById } : {}),
    },
    select: { id: true },
  });
  const dateOptionIds: string[] = [];
  for (const startsAt of input.dates) {
    const option = await db.pollOption.create({
      data: { pollId: poll.id, clubId: input.clubId, category: "DATE", startsAt },
      select: { id: true },
    });
    dateOptionIds.push(option.id);
  }
  const placeOptionIds: string[] = [];
  for (const placeId of input.placeIds) {
    const option = await db.pollOption.create({
      data: { pollId: poll.id, clubId: input.clubId, category: "PLACE", placeId },
      select: { id: true },
    });
    placeOptionIds.push(option.id);
  }
  return { pollId: poll.id, dateOptionIds, placeOptionIds };
}

/** A ballot written directly: the ticked option ids (their categories are looked up). */
export async function insertBallot(input: {
  pollId: string;
  userId: string;
  optionIds: string[];
  noDateWorks?: boolean;
}): Promise<string> {
  const ballot = await db.pollBallot.create({
    data: { pollId: input.pollId, userId: input.userId, noDateWorks: input.noDateWorks ?? false },
    select: { id: true },
  });
  if (input.optionIds.length > 0) {
    const options = await db.pollOption.findMany({
      where: { id: { in: input.optionIds }, pollId: input.pollId },
      select: { id: true, category: true },
    });
    await db.pollVote.createMany({
      data: options.map((option) => ({
        ballotId: ballot.id,
        pollId: input.pollId,
        optionId: option.id,
        category: option.category,
      })),
    });
  }
  return ballot.id;
}

/** Moves the deadline into the past (time travel for "the deadline has passed"). */
export async function expirePoll(pollId: string, msAgo = MINUTE): Promise<void> {
  await db.poll.update({ where: { id: pollId }, data: { deadline: new Date(Date.now() - msAgo) } });
}

export async function pollState(pollId: string) {
  return db.poll.findUniqueOrThrow({
    where: { id: pollId },
    select: {
      status: true,
      closeReason: true,
      closedAt: true,
      closedById: true,
      cancelledAt: true,
      cancelledById: true,
      updatedAt: true,
    },
  });
}

/** The poll's events (0 or 1; events.poll_id is UNIQUE). */
export async function eventsOfPoll(pollId: string) {
  return db.event.findMany({
    where: { pollId },
    select: {
      id: true,
      clubId: true,
      title: true,
      theme: true,
      description: true,
      startsAt: true,
      endsAt: true,
      placeId: true,
      createdById: true,
      pollId: true,
      hosts: { select: { userId: true } },
    },
  });
}

/** Days from now (a future instant, whole milliseconds). */
export function inDays(days: number, from = Date.now()): Date {
  return new Date(from + days * DAY);
}
