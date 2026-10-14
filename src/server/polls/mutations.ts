import "server-only";

import type { PollPlacesInput } from "@/lib/validation/poll";
import { db, type TransactionClient } from "@/server/db";
import { lockMemberIds, lockPlace, lockPoll, type LockedPoll } from "@/server/db/locks";
import type { ClubRole } from "@/server/domain/clubs/permissions";
import {
  checkBallotChoice,
  type BallotChoice,
  type BallotErrorCode,
} from "@/server/domain/polls/ballot";
import { shouldAutoClose } from "@/server/domain/polls/lifecycle";
import {
  ACTIVE_POLL_STATUSES,
  hasSomethingToVoteOn,
  isActivePollStatus,
  MAX_POLL_DATE_OPTIONS,
  MAX_POLL_PLACE_OPTIONS,
  type PollCategory,
} from "@/server/domain/polls/options";
import {
  canCancelPoll,
  canClosePoll,
  canEditPoll,
  canManagePoll,
  canResolveTie,
} from "@/server/domain/polls/permissions";
import { checkPollTiming, type PollTimingError } from "@/server/domain/polls/schedule";
import {
  resolveWinner,
  tallyPoll,
  tiedCategories,
  type Resolutions,
} from "@/server/domain/polls/tally";
import { PlaceNotSelectableError } from "@/server/events/mutations";
import { findOrCreatePlaceTx } from "@/server/places/mutations";

import {
  closeLockedPollTx,
  createEventFromPollTx,
  readMemberIds,
  readTallyInputs,
  type CloseOutcome,
} from "./close";

export type { PollPlacesInput };
export { PlaceNotSelectableError };

/**
 * Writes for polls (SPEC §9.7, D-129–D-134).
 *
 * Authorization is checked by the Server Actions first (membership with
 * requirePoll, the can* rules), and AGAIN here under lockPoll with the actor's
 * role read inside the transaction (an action's earlier check may be stale).
 * Results are unions, not exceptions – except PlaceNotSelectableError, which
 * createPoll throws like createEvent does (→ fieldErrors.placeIds). Prisma
 * errors are never caught inside a transaction: every invariant is checked
 * under the locks first (src/server/db/locks.ts for the lock order).
 *
 * Every function scopes by clubId (§4.4): another club's poll is "not-found".
 */

type Tx = TransactionClient;

/** Rolls the transaction back (a new place must not stay behind) and becomes a result outside it. */
class CreatePollRollback extends Error {
  constructor(readonly result: { status: "not-member" } | { status: "nothing-to-vote" }) {
    super(result.status);
    this.name = "CreatePollRollback";
  }
}

/** The actor's role in the club, read inside the transaction (null: not a member). */
async function roleOf(tx: Tx, clubId: string, userId: string): Promise<{ role: ClubRole } | null> {
  return tx.membership.findFirst({ where: { clubId, userId }, select: { role: true } });
}

export type CreatePollResult =
  | { status: "created"; id: string }
  | { status: "not-member" }
  | { status: "timing"; error: PollTimingError }
  | { status: "nothing-to-vote" };

/**
 * "Planlæg ølsmagning" (§9.7.1). One transaction:
 *   1. "＋ Nyt sted" → findOrCreatePlaceTx (name advisory; an ACTIVE place with
 *      the same name is reused, E29);
 *   2. the chosen places locked FOR SHARE in id order: unknown or another
 *      club's → PlaceNotSelectableError("NOT_FOUND"), archived → ("ARCHIVED");
 *   3. the places deduplicated (the new place may be one of the chosen);
 *   4. the creator's membership FOR SHARE (not a member → not-member);
 *   5. at least one category with two options (D-134) → else nothing-to-vote;
 *   6. the poll and its options (unchecked scalars).
 * Timing (dates and deadline in the future, deadline before the first date)
 * is checked before anything is written. Lock order: name advisory → places
 * → memberships; a new poll needs no poll lock.
 */
export async function createPoll(input: {
  clubId: string;
  createdById: string;
  now: Date;
  title: string;
  theme: string | null;
  description: string | null;
  deadline: Date;
  dateStartsAt: Date[];
  places: PollPlacesInput;
}): Promise<CreatePollResult> {
  const { clubId, createdById, now, deadline, places } = input;
  const dateStartsAt = [...new Set(input.dateStartsAt.map((date) => date.getTime()))]
    .sort((a, b) => a - b)
    .map((time) => new Date(time));
  if (dateStartsAt.length > MAX_POLL_DATE_OPTIONS) return { status: "nothing-to-vote" };
  const timing = checkPollTiming({ now, deadline, dateStartsAt });
  if (timing) return { status: "timing", error: timing };

  try {
    return await db.$transaction(async (tx) => {
      const placeIds: string[] = [];
      if (places.newPlace) {
        const created = await findOrCreatePlaceTx(tx, {
          clubId,
          createdById,
          name: places.newPlace.name,
          address: places.newPlace.address,
          ownedByCreator: places.newPlace.ownedByCreator,
        });
        placeIds.push(created.placeId);
      }
      for (const placeId of [...new Set(places.existingIds)].sort()) {
        const locked = await lockPlace(tx, clubId, placeId, "SHARE");
        if (!locked) throw new PlaceNotSelectableError("NOT_FOUND");
        if (locked.archivedAt !== null) throw new PlaceNotSelectableError("ARCHIVED");
        if (!placeIds.includes(locked.id)) placeIds.push(locked.id);
      }

      const members = await lockMemberIds(tx, clubId, [createdById]);
      if (!members.has(createdById)) throw new CreatePollRollback({ status: "not-member" });
      if (
        placeIds.length > MAX_POLL_PLACE_OPTIONS ||
        !hasSomethingToVoteOn(dateStartsAt.length, placeIds.length)
      ) {
        throw new CreatePollRollback({ status: "nothing-to-vote" });
      }

      const poll = await tx.poll.create({
        data: {
          clubId,
          createdById,
          title: input.title,
          theme: input.theme,
          description: input.description,
          deadline,
        },
        select: { id: true },
      });
      await tx.pollOption.createMany({
        data: [
          ...dateStartsAt.map((startsAt) => ({
            pollId: poll.id,
            clubId,
            category: "DATE" as const,
            startsAt,
          })),
          ...placeIds.map((placeId) => ({
            pollId: poll.id,
            clubId,
            category: "PLACE" as const,
            placeId,
          })),
        ],
      });
      return { status: "created" as const, id: poll.id };
    });
  } catch (error) {
    if (error instanceof CreatePollRollback) return error.result;
    throw error;
  }
}

export type UpdatePollResult =
  | { status: "updated" }
  | { status: "not-found" }
  | { status: "closed" }
  | { status: "forbidden" }
  | { status: "timing"; error: PollTimingError };

/**
 * "Rediger" (D-133, E24): title, theme, description and the deadline – which
 * may only move later and must stay before the first date. Options never
 * change; ballots are kept. A poll whose deadline has passed is closed here
 * (DEADLINE) and answers "closed".
 */
export async function updatePoll(input: {
  clubId: string;
  pollId: string;
  actorUserId: string;
  now: Date;
  title: string;
  theme: string | null;
  description: string | null;
  deadline: Date;
}): Promise<UpdatePollResult> {
  const { clubId, pollId, actorUserId, now } = input;
  return db.$transaction(async (tx) => {
    const poll = await lockPoll(tx, clubId, pollId);
    if (!poll) return { status: "not-found" };
    if (poll.status !== "OPEN") return { status: "closed" };
    if (now.getTime() >= poll.deadline.getTime()) {
      await closeLockedPollTx(tx, poll, { clubId, reason: "DEADLINE", now, actorUserId: null });
      return { status: "closed" };
    }
    if (!canEditPoll(await roleOf(tx, clubId, actorUserId), poll, actorUserId)) {
      return { status: "forbidden" };
    }

    const dates = await tx.pollOption.findMany({
      where: { pollId, category: "DATE" },
      select: { startsAt: true },
    });
    const timing = checkPollTiming({
      now,
      deadline: input.deadline,
      dateStartsAt: dates.flatMap((date) => (date.startsAt ? [date.startsAt] : [])),
      previousDeadline: poll.deadline,
    });
    if (timing) return { status: "timing", error: timing };

    await tx.poll.updateMany({
      where: { id: pollId, clubId, status: "OPEN" },
      data: {
        title: input.title,
        theme: input.theme,
        description: input.description,
        deadline: input.deadline,
      },
    });
    return { status: "updated" };
  });
}

export type CastBallotResult =
  | { status: "saved"; closed: CloseOutcome | null }
  /** Not OPEN, or the deadline had passed (then it was closed in this transaction) – E6. */
  | { status: "closed" }
  | { status: "not-found" }
  | { status: "not-member" }
  | {
      status: "invalid";
      errors: Partial<Record<"dateOptionIds" | "placeOptionId", BallotErrorCode>>;
    };

/**
 * "Gem min stemme" / "Opdatér min stemme" (§9.7.2, D-013, D-134). One
 * transaction under the poll lock:
 *   1. not OPEN → closed; deadline passed → close it (DEADLINE) → closed (E6);
 *   2. the voter's membership (a plain read is authoritative under the poll
 *      lock, see locks.ts) → else not-member;
 *   3. checkBallotChoice against the poll's options → invalid (nothing written,
 *      so no FK can fail inside the transaction);
 *   4. the ballot is created or updated and its ticks REPLACED;
 *   5. if every current member now has a complete ballot, the poll is closed
 *      (ALL_VOTED) in this same transaction: the last ballot, the close and the
 *      event commit together (E8).
 */
export async function castBallot(input: {
  clubId: string;
  pollId: string;
  userId: string;
  now: Date;
  choice: BallotChoice;
}): Promise<CastBallotResult> {
  const { clubId, pollId, userId, now, choice } = input;
  return db.$transaction(async (tx) => {
    const poll = await lockPoll(tx, clubId, pollId);
    if (!poll) return { status: "not-found" };
    if (poll.status !== "OPEN") return { status: "closed" };
    if (now.getTime() >= poll.deadline.getTime()) {
      await closeLockedPollTx(tx, poll, { clubId, reason: "DEADLINE", now, actorUserId: null });
      return { status: "closed" };
    }
    if (!(await roleOf(tx, clubId, userId))) return { status: "not-member" };

    const options = await tx.pollOption.findMany({
      where: { pollId },
      select: { id: true, category: true },
    });
    const check = checkBallotChoice(options, choice);
    if (!check.ok) return { status: "invalid", errors: check.errors };

    const existing = await tx.pollBallot.findFirst({
      where: { pollId, userId },
      select: { id: true },
    });
    let ballotId: string;
    if (existing) {
      ballotId = existing.id;
      // Also moves updatedAt ("Du har stemt ✓"), even when noDateWorks is unchanged.
      await tx.pollBallot.updateMany({
        where: { id: ballotId, pollId },
        data: { noDateWorks: check.noDateWorks, updatedAt: new Date() },
      });
      await tx.pollVote.deleteMany({ where: { ballotId } });
    } else {
      ballotId = (
        await tx.pollBallot.create({
          data: { pollId, userId, noDateWorks: check.noDateWorks },
          select: { id: true },
        })
      ).id;
    }
    if (check.votes.length > 0) {
      await tx.pollVote.createMany({
        data: check.votes.map((vote) => ({
          ballotId,
          pollId,
          optionId: vote.optionId,
          category: vote.category,
        })),
      });
    }

    const inputs = await readTallyInputs(tx, pollId);
    const memberIds = await readMemberIds(tx, clubId);
    const reason = shouldAutoClose({
      status: poll.status,
      deadline: poll.deadline,
      now,
      options: inputs.options,
      memberIds,
      ballots: inputs.ballots,
    });
    const closed =
      reason === "ALL_VOTED"
        ? await closeLockedPollTx(tx, poll, { clubId, reason, now, actorUserId: null })
        : null;
    return { status: "saved", closed };
  });
}

export type ClosePollManuallyResult =
  | { status: "closed"; outcome: CloseOutcome }
  | { status: "not-found" }
  | { status: "forbidden" }
  | { status: "already-final" };

/**
 * "Afslut afstemning nu" (creator while a member, or an admin; E11). A poll
 * whose deadline has already passed is closed as DEADLINE (what really ended
 * it); otherwise as MANUAL with the actor as closedBy.
 */
export async function closePollManually(input: {
  clubId: string;
  pollId: string;
  actorUserId: string;
  now: Date;
}): Promise<ClosePollManuallyResult> {
  const { clubId, pollId, actorUserId, now } = input;
  return db.$transaction(async (tx) => {
    const poll = await lockPoll(tx, clubId, pollId);
    if (!poll) return { status: "not-found" };
    const role = await roleOf(tx, clubId, actorUserId);
    if (!canManagePoll(role, poll, actorUserId)) return { status: "forbidden" };
    if (!canClosePoll(role, poll, actorUserId)) return { status: "already-final" };

    const expired = now.getTime() >= poll.deadline.getTime();
    const outcome = await closeLockedPollTx(tx, poll, {
      clubId,
      reason: expired ? "DEADLINE" : "MANUAL",
      now,
      actorUserId,
    });
    return outcome ? { status: "closed", outcome } : { status: "already-final" };
  });
}

export type ResolvePollTieResult =
  | { status: "closed"; eventId: string }
  | { status: "not-found" }
  | { status: "forbidden" }
  | { status: "not-awaiting" }
  | { status: "invalid-choice"; categories: PollCategory[] };

/**
 * "Vælg vinder" after a tie (D-008): the choice per tied category must be
 * one of the tied options (resolveWinner, strict). The ballots are frozen
 * since the close, so the tally is recomputed. Stores a PollTieResolution per
 * tied category, closes the poll and creates the event – one transaction.
 */
export async function resolvePollTie(input: {
  clubId: string;
  pollId: string;
  actorUserId: string;
  now: Date;
  choices: Resolutions;
}): Promise<ResolvePollTieResult> {
  const { clubId, pollId, actorUserId, choices } = input;
  return db.$transaction(async (tx) => {
    const poll = await lockPoll(tx, clubId, pollId);
    if (!poll) return { status: "not-found" };
    const role = await roleOf(tx, clubId, actorUserId);
    if (!canManagePoll(role, poll, actorUserId)) return { status: "forbidden" };
    if (!canResolveTie(role, poll, actorUserId)) return { status: "not-awaiting" };

    const inputs = await readTallyInputs(tx, pollId);
    const tally = tallyPoll(inputs.options, inputs.ballots);
    const winner = resolveWinner(tally, choices);
    if (!winner.ok) {
      return {
        status: "invalid-choice",
        categories: winner.reason === "TIE" ? winner.tied : winner.categories,
      };
    }

    const tied = tiedCategories(tally);
    await tx.pollTieResolution.createMany({
      data: tied.map((category) => ({
        pollId,
        category,
        chosenOptionId: category === "DATE" ? winner.dateOptionId : winner.placeOptionId,
        chosenById: actorUserId,
      })),
    });
    const { count } = await tx.poll.updateMany({
      where: { id: pollId, clubId, status: "AWAITING_DECISION" },
      data: { status: "CLOSED" },
    });
    // Guaranteed by the lock; a mismatch must roll everything back.
    if (count !== 1) throw new Error("The poll left AWAITING_DECISION under its lock.");

    const eventId = await createEventFromPollTx(tx, {
      clubId,
      poll: poll satisfies LockedPoll,
      dateOptionId: winner.dateOptionId,
      placeOptionId: winner.placeOptionId,
      actorUserId,
    });
    return { status: "closed", eventId };
  });
}

export type CancelPollResult =
  | { status: "cancelled" }
  | { status: "not-found" }
  | { status: "forbidden" }
  | { status: "already-final" };

/**
 * "Annullér afstemning" (OPEN or AWAITING_DECISION). No event is created;
 * the ballots stay so the club can still see them. A cancel from
 * AWAITING_DECISION keeps closeReason/closedAt.
 */
export async function cancelPoll(input: {
  clubId: string;
  pollId: string;
  actorUserId: string;
  now: Date;
}): Promise<CancelPollResult> {
  const { clubId, pollId, actorUserId, now } = input;
  return db.$transaction(async (tx) => {
    const poll = await lockPoll(tx, clubId, pollId);
    if (!poll) return { status: "not-found" };
    const role = await roleOf(tx, clubId, actorUserId);
    if (!canManagePoll(role, poll, actorUserId)) return { status: "forbidden" };
    if (!isActivePollStatus(poll.status) || !canCancelPoll(role, poll, actorUserId)) {
      return { status: "already-final" };
    }
    const { count } = await tx.poll.updateMany({
      where: { id: pollId, clubId, status: { in: [...ACTIVE_POLL_STATUSES] } },
      data: { status: "CANCELLED", cancelledAt: now, cancelledById: actorUserId },
    });
    return count === 1 ? { status: "cancelled" } : { status: "already-final" };
  });
}
