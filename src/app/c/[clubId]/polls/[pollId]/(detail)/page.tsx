import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PollAutoRefresh } from "@/components/features/polls/poll-auto-refresh";
import { PollHeader } from "@/components/features/polls/poll-header";
import { PollManageActions } from "@/components/features/polls/poll-manage-actions";
import { PollResults } from "@/components/features/polls/poll-results";
import { PollStatusPanel } from "@/components/features/polls/poll-status-panel";
import { PollVoteForm } from "@/components/features/polls/poll-vote-form";
import { VotingProgress } from "@/components/features/polls/voting-progress";
import { isVotingOpen } from "@/server/domain/polls/lifecycle";
import { canManagePoll } from "@/server/domain/polls/permissions";
import { requirePoll, requirePollPage } from "@/server/polls/access";
import { closePollIfDueSafely } from "@/server/polls/close";
import { getPollView } from "@/server/polls/queries";

export async function generateMetadata({
  params,
}: PageProps<"/c/[clubId]/polls/[pollId]">): Promise<Metadata> {
  const { clubId, pollId } = await params;
  // Cached with the guard layout's call; never writes.
  const { poll } = await requirePoll(clubId, pollId);
  return { title: poll.title };
}

/**
 * One poll (SPEC §9.7.3–§9.7.7): the header, the outcome/tie/cancel panel,
 * the vote form while voting is open (else the results), who has voted, and
 * the creator's/admins' actions.
 *
 * The guard layout has already given a real 404 for a poll that is not in
 * this club (E22). The page then closes the poll lazily when it is due
 * (deadline or everyone voted, D-131) – never in the layout, and it never
 * throws – and reads the view UNCACHED after it, so a poll that just closed
 * renders as closed (the layout's cached PollRef may still say OPEN).
 */
export default async function PollPage({ params }: PageProps<"/c/[clubId]/polls/[pollId]">) {
  const { clubId, pollId } = await params;
  const { user, membership, club, poll } = await requirePollPage(clubId, pollId);
  const now = new Date();
  await closePollIfDueSafely(club.id, poll.id, now);
  const view = await getPollView(club.id, poll.id, user.id);
  if (!view) notFound();
  const canManage = canManagePoll(membership, view, user.id);
  const votingOpen = isVotingOpen(view, now);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <PollAutoRefresh active={view.status === "OPEN"} />
      <PollHeader view={view} now={now} />
      <PollStatusPanel clubId={club.id} view={view} canManage={canManage} now={now} />
      {votingOpen ? (
        <PollVoteForm clubId={club.id} view={view} now={now} />
      ) : (
        <PollResults view={view} now={now} />
      )}
      <VotingProgress view={view} />
      <PollManageActions clubId={club.id} view={view} canManage={canManage} now={now} />
    </div>
  );
}
