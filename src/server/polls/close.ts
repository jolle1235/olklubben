import "server-only";

import { db, type TransactionClient } from "@/server/db";
import { lockMemberIds, lockPlace, lockPoll, type LockedPoll } from "@/server/db/locks";
import type { BallotVotes } from "@/server/domain/polls/ballot";
import { eventFieldsFromPoll, pollEventHostIds } from "@/server/domain/polls/event-from-poll";
import { shouldAutoClose } from "@/server/domain/polls/lifecycle";
import type { PollCategory, PollCloseReason, PollOptionRef } from "@/server/domain/polls/options";
import { resolveWinner, tallyPoll } from "@/server/domain/polls/tally";

/**
 * Closing a poll (SPEC §9.7.4–§9.7.7, D-007, D-008, D-130, D-131): ONE
 * function, closeLockedPollTx, behind every trigger – the vote that completes
 * the roster (castBallot), "Afslut afstemning nu", the lazy close on Overblik,
 * Kalender and the poll page, and the daily cron.
 *
 *   * The caller holds lockPoll (FOR NO KEY UPDATE) in the same transaction,
 *     so ballots cannot change meanwhile, and the conditional
 *     `UPDATE … WHERE status = 'OPEN'` makes a second close a no-op (E7).
 *   * A clear winner (or fixed categories) → CLOSED, and the event is created
 *     in the SAME transaction (createEventFromPollTx). events.poll_id UNIQUE is
 *     only the backstop. A tie in any category → AWAITING_DECISION, no event;
 *     the creator or an admin chooses (resolvePollTie in ./mutations.ts).
 *   * Lock order (src/server/db/locks.ts): poll → winning place (SHARE) →
 *     memberships (SHARE). Never the club.
 *
 * The lazy close (closeDuePolls, closePollIfDueSafely) runs in pages only,
 * never in layouts (D-052), and never throws: a failure is logged and the
 * page renders the poll as it is. Nothing here calls revalidatePath (a page
 * render must not; the cron route revalidates the clubs it touched).
 */

type Tx = TransactionClient;

export type CloseOutcome =
  { status: "CLOSED"; eventId: string } | { status: "AWAITING_DECISION"; tied: PollCategory[] };

export type TallyInputs = {
  options: PollOptionRef[];
  ballots: BallotVotes[];
};

/** The poll's options (DATE by time, then PLACE) and ballots with their ticks. */
export async function readTallyInputs(tx: Tx, pollId: string): Promise<TallyInputs> {
  // Sequential: one connection per interactive transaction.
  const options = await tx.pollOption.findMany({
    where: { pollId },
    select: { id: true, category: true },
    orderBy: [{ category: "asc" }, { startsAt: "asc" }, { id: "asc" }],
  });
  const ballots = await tx.pollBallot.findMany({
    where: { pollId },
    select: { userId: true, noDateWorks: true, votes: { select: { optionId: true } } },
    orderBy: { id: "asc" },
  });
  return {
    options,
    ballots: ballots.map((ballot) => ({
      userId: ballot.userId,
      noDateWorks: ballot.noDateWorks,
      optionIds: ballot.votes.map((vote) => vote.optionId),
    })),
  };
}

/** The club's current member ids. Under lockPoll this read is authoritative (locks.ts, C2). */
export async function readMemberIds(tx: Tx, clubId: string): Promise<Set<string>> {
  const rows = await tx.membership.findMany({ where: { clubId }, select: { userId: true } });
  return new Set(rows.map((row) => row.userId));
}

async function closeWithInputsTx(
  tx: Tx,
  poll: LockedPoll,
  inputs: TallyInputs,
  input: { clubId: string; reason: PollCloseReason; now: Date; actorUserId: string | null },
): Promise<CloseOutcome | null> {
  if (poll.status !== "OPEN") return null;
  if (input.reason === "MANUAL" && input.actorUserId === null) {
    throw new Error("A manual close needs the acting user (polls_manual_closer_check).");
  }
  const winner = resolveWinner(tallyPoll(inputs.options, inputs.ballots));

  const { count } = await tx.poll.updateMany({
    where: { id: poll.id, clubId: input.clubId, status: "OPEN" },
    data: {
      status: winner.ok ? "CLOSED" : "AWAITING_DECISION",
      closeReason: input.reason,
      closedAt: input.now,
      closedById: input.reason === "MANUAL" ? input.actorUserId : null,
    },
  });
  if (count !== 1) return null;

  if (!winner.ok) {
    // Without resolutions resolveWinner only answers TIE.
    return { status: "AWAITING_DECISION", tied: winner.reason === "TIE" ? winner.tied : [] };
  }
  const eventId = await createEventFromPollTx(tx, {
    clubId: input.clubId,
    poll,
    dateOptionId: winner.dateOptionId,
    placeOptionId: winner.placeOptionId,
    actorUserId: input.actorUserId,
  });
  return { status: "CLOSED", eventId };
}

/**
 * Ends the voting of a poll that the caller locked with lockPoll in THIS
 * transaction: tally → CLOSED with its event, or AWAITING_DECISION on a tie.
 * Null when it was not OPEN (idempotent, E7): nothing is written then.
 * `actorUserId`: the user who closed it manually (required for MANUAL) or
 * whose action triggered it; null for an automatic close (deadline, cron).
 */
export async function closeLockedPollTx(
  tx: Tx,
  poll: LockedPoll,
  input: { clubId: string; reason: PollCloseReason; now: Date; actorUserId: string | null },
): Promise<CloseOutcome | null> {
  if (poll.status !== "OPEN") return null;
  return closeWithInputsTx(tx, poll, await readTallyInputs(tx, poll.id), input);
}

/**
 * Creates the poll's event (§9.7.7) inside the closing transaction: the
 * winning date and place, the poll's texts, Event.createdById = the poll's
 * creator, and the hosts = the winning place's member owners → the creator if
 * still a member (D-009) → the acting user (E11) → nobody (E34). An archived
 * winning place is accepted (it was chosen while active). Exported for
 * resolvePollTie. Returns the event id.
 */
export async function createEventFromPollTx(
  tx: Tx,
  input: {
    clubId: string;
    poll: LockedPoll;
    dateOptionId: string;
    placeOptionId: string;
    actorUserId: string | null;
  },
): Promise<string> {
  const { clubId, poll, actorUserId } = input;
  const dateOption = await tx.pollOption.findFirst({
    where: { id: input.dateOptionId, pollId: poll.id, clubId, category: "DATE" },
    select: { startsAt: true },
  });
  const placeOption = await tx.pollOption.findFirst({
    where: { id: input.placeOptionId, pollId: poll.id, clubId, category: "PLACE" },
    select: { placeId: true },
  });
  if (!dateOption?.startsAt || !placeOption?.placeId) {
    throw new Error("The winning options are not options of this poll.");
  }

  // SHARE: the place cannot be archived or deleted until the event points at it.
  const place = await lockPlace(tx, clubId, placeOption.placeId, "SHARE");
  if (!place) throw new Error("The winning place is not in the poll's club.");
  const owners = await tx.placeOwner.findMany({
    where: { placeId: place.id, clubId },
    select: { userId: true },
    orderBy: { createdAt: "asc" },
  });
  const ownerIds = owners.map((owner) => owner.userId);

  // FOR SHARE: a concurrent leave waits, so every host is a member when written.
  const memberIds = await lockMemberIds(tx, clubId, [
    ...ownerIds,
    poll.createdById,
    ...(actorUserId ? [actorUserId] : []),
  ]);
  const hostIds = pollEventHostIds({
    ownerIds,
    creatorId: poll.createdById,
    actorUserId,
    memberIds,
  });

  const fields = eventFieldsFromPoll(poll, {
    startsAt: dateOption.startsAt,
    placeId: place.id,
  });
  // Unchecked scalar input only: clubId takes part in three relations (D-096).
  const event = await tx.event.create({
    data: {
      clubId,
      pollId: poll.id,
      ...fields,
      hosts: { createMany: { data: hostIds.map((userId) => ({ userId })) } },
    },
    select: { id: true },
  });
  return event.id;
}

/**
 * Closes the poll if it is due (deadline or every current member voted),
 * decided under the poll lock in its own transaction. Null when it is not due,
 * not OPEN, or not in the club.
 */
export async function closePollIfDue(
  clubId: string,
  pollId: string,
  now: Date,
): Promise<CloseOutcome | null> {
  return db.$transaction(async (tx) => {
    const poll = await lockPoll(tx, clubId, pollId);
    if (!poll || poll.status !== "OPEN") return null;
    const inputs = await readTallyInputs(tx, poll.id);
    const memberIds = await readMemberIds(tx, clubId);
    const reason = shouldAutoClose({
      status: poll.status,
      deadline: poll.deadline,
      now,
      options: inputs.options,
      memberIds,
      ballots: inputs.ballots,
    });
    if (!reason) return null;
    return closeWithInputsTx(tx, poll, inputs, { clubId, reason, now, actorUserId: null });
  });
}

/** The poll page's lazy close: closePollIfDue that never throws (logged instead). */
export async function closePollIfDueSafely(
  clubId: string,
  pollId: string,
  now: Date,
): Promise<CloseOutcome | null> {
  try {
    return await closePollIfDue(clubId, pollId, now);
  } catch (error) {
    console.error("[polls] close failed", { clubId, pollId }, error);
    return null;
  }
}

export type CloseDueResult = { closed: number; awaiting: number; failed: number };

/**
 * The lazy close of Overblik and Kalender, and the cron per club: ONE
 * unlocked read of the club's OPEN polls (options, ballots, ticks) and member
 * ids, shouldAutoClose in JS, then closePollIfDue per candidate – one after
 * the other, each in its own transaction and decided again under the lock.
 * NEVER throws: each failure is logged and counted.
 */
export async function closeDuePolls(clubId: string, now: Date): Promise<CloseDueResult> {
  const result: CloseDueResult = { closed: 0, awaiting: 0, failed: 0 };
  let candidates: string[];
  try {
    const [polls, members] = await Promise.all([
      db.poll.findMany({
        where: { clubId, status: "OPEN" },
        select: {
          id: true,
          status: true,
          deadline: true,
          options: { select: { id: true, category: true } },
          ballots: {
            select: { userId: true, noDateWorks: true, votes: { select: { optionId: true } } },
          },
        },
        orderBy: [{ deadline: "asc" }, { id: "asc" }],
      }),
      db.membership.findMany({ where: { clubId }, select: { userId: true } }),
    ]);
    const memberIds = new Set(members.map((member) => member.userId));
    candidates = polls
      .filter(
        (poll) =>
          shouldAutoClose({
            status: poll.status,
            deadline: poll.deadline,
            now,
            options: poll.options,
            memberIds,
            ballots: poll.ballots.map((ballot) => ({
              userId: ballot.userId,
              noDateWorks: ballot.noDateWorks,
              optionIds: ballot.votes.map((vote) => vote.optionId),
            })),
          }) !== null,
      )
      .map((poll) => poll.id);
  } catch (error) {
    console.error("[polls] close failed", { clubId }, error);
    result.failed += 1;
    return result;
  }

  for (const pollId of candidates) {
    try {
      const outcome = await closePollIfDue(clubId, pollId, now);
      if (outcome?.status === "CLOSED") result.closed += 1;
      else if (outcome?.status === "AWAITING_DECISION") result.awaiting += 1;
    } catch (error) {
      console.error("[polls] close failed", { clubId, pollId }, error);
      result.failed += 1;
    }
  }
  return result;
}

export type CloseAllDueResult = CloseDueResult & { clubs: number; touchedClubIds: string[] };

/** Clubs per cron run (Vercel's maxDuration is 60 s; the next night takes the rest). */
const DEFAULT_CRON_CLUB_LIMIT = 200;

/**
 * The daily cron (§4.8, D-131): every club with OPEN polls (earliest deadline
 * first, at most `clubLimit`) → closeDuePolls. Returns the totals and the
 * clubs where something closed (the route revalidates them). Never throws for
 * one club's failure.
 */
export async function closeAllDuePolls(
  now: Date,
  opts: { clubLimit?: number } = {},
): Promise<CloseAllDueResult> {
  const groups = await db.poll.groupBy({
    by: ["clubId"],
    where: { status: "OPEN" },
    _min: { deadline: true },
    orderBy: { _min: { deadline: "asc" } },
    take: opts.clubLimit ?? DEFAULT_CRON_CLUB_LIMIT,
  });
  const total: CloseAllDueResult = {
    clubs: groups.length,
    closed: 0,
    awaiting: 0,
    failed: 0,
    touchedClubIds: [],
  };
  for (const { clubId } of groups) {
    const result = await closeDuePolls(clubId, now);
    total.closed += result.closed;
    total.awaiting += result.awaiting;
    total.failed += result.failed;
    if (result.closed + result.awaiting > 0) total.touchedClubIds.push(clubId);
  }
  return total;
}
