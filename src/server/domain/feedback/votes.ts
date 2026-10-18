/**
 * 👍 on feedback (SPEC §9.9, §3.4, D-144). The count is COMPUTED, never
 * stored: the author always counts as 1 ("den tæller automatisk som 1") plus
 * one per FeedbackVote row. The +1 stays after the author deletes their
 * account (E27): the report still came from someone.
 *
 * Pure module: no Next.js, React or database imports. Client-safe.
 */

export function feedbackVoteCount(voteRows: number): number {
  return voteRows + 1;
}

export type FeedbackVoteSortable = { id: string; voteCount: number; createdAt: Date };

/** "Flest stemmer": most 👍 first, then newest, then id (stable). */
export function compareFeedbackByVotes(a: FeedbackVoteSortable, b: FeedbackVoteSortable): number {
  return (
    b.voteCount - a.voteCount ||
    b.createdAt.getTime() - a.createdAt.getTime() ||
    (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)
  );
}
