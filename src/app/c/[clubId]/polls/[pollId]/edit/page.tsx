import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PollEditForm } from "@/components/features/polls/poll-edit-form";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { rememberActiveClub } from "@/server/auth/session";
import { canEditPoll } from "@/server/domain/polls/permissions";
import { requirePoll } from "@/server/polls/access";
import { getPollView } from "@/server/polls/queries";

export const metadata: Metadata = { title: "Rediger afstemning" };

/**
 * Edit a poll (D-133): the creator while a member, or an admin, while it is
 * OPEN – title, theme, description and a later deadline. Anyone else, and a
 * poll that is no longer open, gets a real 404 – there is no loading.tsx
 * above this page (TG-008). Like the other 404s (D-066, D-089), the
 * permission 404 comes before the active club changes. No lazy close here:
 * updatePoll closes an expired poll itself and answers "poll-locked".
 */
export default async function EditPollPage({
  params,
}: PageProps<"/c/[clubId]/polls/[pollId]/edit">) {
  const { clubId, pollId } = await params;
  const { user, membership, club, poll } = await requirePoll(clubId, pollId);
  if (!canEditPoll(membership, poll, user.id)) notFound();
  await rememberActiveClub(user, club.id);

  const view = await getPollView(club.id, poll.id, user.id);
  if (!view) notFound();

  return (
    <>
      <PageHeader
        title="Rediger afstemning"
        description={<span className="break-words hyphens-auto">{view.title}</span>}
      />
      <Card className="max-w-2xl">
        <CardContent>
          <PollEditForm clubId={club.id} view={view} />
        </CardContent>
      </Card>
    </>
  );
}
