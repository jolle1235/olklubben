import { isBallotComplete, type BallotVotes } from "./ballot";
import type { PollOptionRef, PollStatus } from "./options";

/**
 * When voting ends (SPEC §9.7.5, D-131, E6–E8, E12).
 *
 *   * Voting is open while the poll is OPEN and now < deadline.
 *   * An OPEN poll is due to close at the deadline (DEADLINE, it takes
 *     precedence) or when every CURRENT member has a complete ballot
 *     (ALL_VOTED). Ballots of former members never fill a seat, and a new
 *     member without a ballot keeps the poll open (E12).
 *
 * The data layer decides again under lockPoll (src/server/polls/close.ts).
 *
 * Pure module: no Next.js, React or database imports. Client-safe.
 */

export type AutoCloseReason = "DEADLINE" | "ALL_VOTED";

/** OPEN && now < deadline. */
export function isVotingOpen(poll: { status: PollStatus; deadline: Date }, now: Date): boolean {
  return poll.status === "OPEN" && now.getTime() < poll.deadline.getTime();
}

/** Current members with a complete ballot (E12: non-members are ignored). */
export function votedMemberIds(
  memberIds: ReadonlySet<string>,
  ballots: readonly BallotVotes[],
  options: readonly PollOptionRef[],
): Set<string> {
  const voted = new Set<string>();
  for (const ballot of ballots) {
    if (memberIds.has(ballot.userId) && isBallotComplete(options, ballot)) voted.add(ballot.userId);
  }
  return voted;
}

export function shouldAutoClose(input: {
  status: PollStatus;
  deadline: Date;
  now: Date;
  options: readonly PollOptionRef[];
  memberIds: ReadonlySet<string>;
  ballots: readonly BallotVotes[];
}): AutoCloseReason | null {
  if (input.status !== "OPEN") return null;
  if (input.now.getTime() >= input.deadline.getTime()) return "DEADLINE";
  if (input.memberIds.size === 0) return null;
  const voted = votedMemberIds(input.memberIds, input.ballots, input.options);
  return voted.size === input.memberIds.size ? "ALL_VOTED" : null;
}
