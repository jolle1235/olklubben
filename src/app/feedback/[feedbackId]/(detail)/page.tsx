import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, PencilIcon } from "lucide-react";

import { DeleteFeedbackButton } from "@/components/features/feedback/delete-feedback-button";
import {
  FeedbackAdminResponse,
  FeedbackDuplicateNote,
  FeedbackMeta,
  FeedbackTechInfo,
  FeedbackText,
} from "@/components/features/feedback/feedback-detail";
import { voteNoun } from "@/components/features/feedback/feedback-labels";
import { FeedbackModerationForm } from "@/components/features/feedback/feedback-moderation-form";
import { UpvoteButton } from "@/components/features/feedback/upvote-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LinkPendingIcon } from "@/components/ui/link-pending";
import { PageHeader } from "@/components/ui/page-header";
import { editFeedbackHref, feedbackListHref } from "@/lib/routes";
import {
  canDeleteFeedback,
  canEditFeedback,
  canModerateFeedback,
  canSeeFeedbackTechInfo,
  canVoteOnFeedback,
} from "@/server/domain/feedback/permissions";
import { requireFeedback } from "@/server/feedback/access";
import { getFeedbackDetail, listDuplicateTargets } from "@/server/feedback/queries";

export async function generateMetadata({
  params,
}: PageProps<"/feedback/[feedbackId]">): Promise<Metadata> {
  const { feedbackId } = await params;
  // Cached with the guard layout's call; never writes.
  const { feedback } = await requireFeedback(feedbackId);
  return { title: feedback.title };
}

/**
 * One report (SPEC §9.9 "Detaljeside"): title, type, status, author and date,
 * for a bug the page (without the club id, E26), the description as plain
 * text, "Dublet af «…»", the app-admin's answer, the 👍 (or, on your own
 * report, that it already counts as 1), [Ret] and [Slet rapport] for its
 * author while Ny or an app-admin, and for app-admins the technical info and
 * the status form.
 *
 * The guard layout has already given a real 404 for an unknown id (D-148).
 * Rights only hide buttons here; every action checks again (D-145).
 */
export default async function FeedbackPage({ params }: PageProps<"/feedback/[feedbackId]">) {
  const { feedbackId } = await params;
  const { viewer } = await requireFeedback(feedbackId);
  const feedback = await getFeedbackDetail(feedbackId, viewer);
  if (!feedback) notFound();

  const rights = { createdById: feedback.createdById, status: feedback.status };
  const canEdit = canEditFeedback(viewer, rights);
  const canDelete = canDeleteFeedback(viewer, rights);
  const canModerate = canModerateFeedback(viewer);
  const targets = canModerate ? await listDuplicateTargets(feedback.id) : [];

  return (
    <>
      <Link
        href={feedbackListHref()}
        className="mb-1 -ml-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 font-semibold text-olive underline-offset-4 hover:underline"
      >
        <ArrowLeftIcon aria-hidden className="size-4" />
        Alle rapporter
      </Link>
      <PageHeader title={feedback.title} />

      <div className="grid max-w-2xl grid-cols-1 gap-6">
        <FeedbackMeta feedback={feedback} />

        {feedback.status === "DUPLICATE" ? (
          <FeedbackDuplicateNote original={feedback.duplicateOf} />
        ) : null}

        <section
          aria-label="Beskrivelse"
          className="rounded-xl border border-border bg-paper px-4 py-4 sm:px-5"
        >
          <FeedbackText text={feedback.description} />
        </section>

        {feedback.adminResponse ? <FeedbackAdminResponse text={feedback.adminResponse} /> : null}

        <section aria-label="Stemmer">
          {feedback.isOwn ? (
            <p className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="font-heading text-2xl leading-none font-bold whitespace-nowrap text-olive">
                <span aria-hidden>👍 </span>
                {feedback.voteCount}
                <span className="sr-only"> {voteNoun(feedback.voteCount)}</span>
              </span>
              <span className="text-muted-foreground">Din rapport tæller automatisk som 1 👍</span>
            </p>
          ) : canVoteOnFeedback(viewer, rights) ? (
            <UpvoteButton
              feedbackId={feedback.id}
              type={feedback.type}
              voted={feedback.viewerHasVoted}
              voteCount={feedback.voteCount}
            />
          ) : null}
        </section>

        {canEdit || canDelete ? (
          <div className="flex flex-wrap gap-3">
            {canEdit ? (
              <Button asChild variant="outline">
                <Link href={editFeedbackHref(feedback.id)}>
                  <LinkPendingIcon icon={<PencilIcon aria-hidden />} />
                  Ret
                </Link>
              </Button>
            ) : null}
            {canDelete ? <DeleteFeedbackButton feedbackId={feedback.id} /> : null}
          </div>
        ) : null}

        {canSeeFeedbackTechInfo(viewer) && feedback.type === "BUG" && feedback.technicalInfo ? (
          <FeedbackTechInfo info={feedback.technicalInfo} />
        ) : null}

        {canModerate ? (
          <Card>
            <CardHeader>
              <h2 className="font-heading text-xl leading-snug text-olive">Status og svar</h2>
              <p className="text-[0.95rem] text-muted-foreground">
                Kun app-admins kan ændre status, svare og markere dubletter.
              </p>
            </CardHeader>
            <CardContent>
              <FeedbackModerationForm
                feedbackId={feedback.id}
                status={feedback.status}
                adminResponse={feedback.adminResponse}
                duplicateOfId={feedback.duplicateOf?.id ?? null}
                targets={targets}
              />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
