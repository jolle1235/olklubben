import { isAdmin, type MembershipRole } from "@/server/domain/clubs/permissions";

import type { PollStatus } from "./options";

/**
 * Poll permissions (SPEC §5.1, §9.7, D-133, E11).
 *
 *   * Every member may plan a poll and vote. Whether voting is still open is
 *     a separate check (isVotingOpen), decided again under lockPoll.
 *   * Managing (edit, close now, cancel, choose the winner after a tie): the
 *     creator WHILE a member, or an admin. A creator who has left has no
 *     membership, so only admins remain (E11).
 *   * Edit and close: only while OPEN. Cancel: OPEN or AWAITING_DECISION.
 *     Choose the winner: only AWAITING_DECISION.
 *
 * The same functions hide buttons in the UI and enforce the rule on the
 * server (the data layer re-checks under the lock). A null membership (not a
 * member) is never allowed anything.
 *
 * Pure module: no Next.js, React or database imports. Client-safe.
 */

type Membership = MembershipRole | null | undefined;

type PollOwner = { createdById: string };
type PollWithStatus = PollOwner & { status: PollStatus };

export function canCreatePoll(membership: Membership): boolean {
  return membership != null;
}

/** Member (status is checked separately under the lock). */
export function canVote(membership: Membership): boolean {
  return membership != null;
}

/** Admin, or the creator WHILE a member (E11: a creator who left → only admins). */
export function canManagePoll(membership: Membership, poll: PollOwner, userId: string): boolean {
  return membership != null && (isAdmin(membership) || poll.createdById === userId);
}

/** Title, theme, description and a later deadline (D-133): manage && OPEN. */
export function canEditPoll(membership: Membership, poll: PollWithStatus, userId: string): boolean {
  return poll.status === "OPEN" && canManagePoll(membership, poll, userId);
}

/** "Afslut afstemning nu": manage && OPEN. */
export function canClosePoll(
  membership: Membership,
  poll: PollWithStatus,
  userId: string,
): boolean {
  return poll.status === "OPEN" && canManagePoll(membership, poll, userId);
}

/** "Annullér afstemning": manage && (OPEN || AWAITING_DECISION). */
export function canCancelPoll(
  membership: Membership,
  poll: PollWithStatus,
  userId: string,
): boolean {
  return (
    (poll.status === "OPEN" || poll.status === "AWAITING_DECISION") &&
    canManagePoll(membership, poll, userId)
  );
}

/** "Vælg vinder" after a tie (D-008): manage && AWAITING_DECISION. */
export function canResolveTie(
  membership: Membership,
  poll: PollWithStatus,
  userId: string,
): boolean {
  return poll.status === "AWAITING_DECISION" && canManagePoll(membership, poll, userId);
}
