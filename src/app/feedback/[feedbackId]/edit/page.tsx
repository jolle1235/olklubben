import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FeedbackForm } from "@/components/features/feedback/feedback-form";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { feedbackHref } from "@/lib/routes";
import { canEditFeedback } from "@/server/domain/feedback/permissions";
import { requireFeedback } from "@/server/feedback/access";
import { getFeedbackDetail } from "@/server/feedback/queries";

export const metadata: Metadata = { title: "Ret rapport" };

/**
 * Ret rapport (SPEC §9.9, D-145): title and description, for the author
 * while the report is Ny, or an app-admin. Anyone else – also the author once
 * the status has changed – gets a real 404 (D-148), like the other edit pages
 * (D-066); the Server Action checks again inside the write.
 *
 * No loading.tsx above this page (D-065): the guard layout has already
 * checked that the report exists.
 */
export default async function EditFeedbackPage({
  params,
}: PageProps<"/feedback/[feedbackId]/edit">) {
  const { feedbackId } = await params;
  const { viewer, feedback: ref } = await requireFeedback(feedbackId);
  if (!canEditFeedback(viewer, ref)) notFound();
  const feedback = await getFeedbackDetail(ref.id, viewer);
  if (!feedback) notFound();

  return (
    <>
      <PageHeader
        title="Ret rapport"
        description={<span className="break-words hyphens-auto">{feedback.title}</span>}
      />
      <Card className="max-w-2xl">
        <CardContent>
          <FeedbackForm
            mode="edit"
            feedbackId={feedback.id}
            type={feedback.type}
            defaults={{ title: feedback.title, description: feedback.description }}
            cancelHref={feedbackHref(feedback.id)}
          />
        </CardContent>
      </Card>
    </>
  );
}
