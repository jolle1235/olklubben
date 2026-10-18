import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquareWarningIcon, PlusIcon } from "lucide-react";

import { FeedbackCard } from "@/components/features/feedback/feedback-card";
import { FeedbackFilters } from "@/components/features/feedback/feedback-filters";
import { feedbackEmptyState } from "@/components/features/feedback/feedback-labels";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { feedbackListHref, newFeedbackHref } from "@/lib/routes";
import { requireUser } from "@/server/auth/session";
import { parseFeedbackListParams } from "@/server/domain/feedback/list-params";
import { getFeedbackViewer } from "@/server/feedback/access";
import { FEEDBACK_LIST_LIMIT, hasOwnFeedback, listFeedback } from "@/server/feedback/queries";

export const metadata: Metadata = { title: "Feedback" };

/**
 * Feedback (SPEC §9.9 "Oversigt"): every user's bug reports and wishes, with
 * the filters type, status (Åbne by default), "Mine rapporter" and the sort
 * (Flest stemmer by default) in the URL, and "＋ Ny rapport" as the primary
 * action. Each card shows the status, author, age and 👍 ("(du har stemt)").
 * At most FEEDBACK_LIST_LIMIT reports (TG-057).
 *
 * A list that never calls notFound() itself, so its loading.tsx may sit next
 * to it in the (list) group (D-065, D-148).
 */
export default async function FeedbackListPage({ searchParams }: PageProps<"/feedback">) {
  const params = parseFeedbackListParams(await searchParams);
  const user = await requireUser({ returnTo: feedbackListHref(params) });
  const viewer = getFeedbackViewer(user);
  const items = await listFeedback(viewer, params);
  const empty =
    items.length === 0
      ? feedbackEmptyState(params, {
          hasOwnReports: params.mine ? await hasOwnFeedback(user.id) : true,
        })
      : null;
  const now = new Date();

  return (
    <>
      <PageHeader
        title="Feedback"
        description="Fejl og ønsker til appen. Alle brugere kan se rapporterne og give en 👍."
        action={
          // One primary action (§13.4.5): an empty list offers "Ny rapport" itself.
          empty && !empty.allMineHref ? undefined : (
            <Button asChild>
              <Link href={newFeedbackHref()}>
                <PlusIcon aria-hidden />
                Ny rapport
              </Link>
            </Button>
          )
        }
      />

      <FeedbackFilters params={params} />

      {empty ? (
        <EmptyState
          icon={<MessageSquareWarningIcon />}
          title={empty.title}
          description={empty.description}
          actions={
            empty.allMineHref ? (
              <Button asChild variant="outline">
                <Link href={empty.allMineHref}>Vis alle mine rapporter</Link>
              </Button>
            ) : (
              <Button asChild size="lg">
                <Link href={newFeedbackHref()}>
                  <PlusIcon aria-hidden />
                  Ny rapport
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          <ul aria-label="Rapporter" className="grid grid-cols-1 gap-3">
            {items.map((item) => (
              <li key={item.id}>
                <FeedbackCard item={item} now={now} />
              </li>
            ))}
          </ul>
          {items.length >= FEEDBACK_LIST_LIMIT ? (
            <p className="mt-4 text-[0.95rem] text-muted-foreground">
              Viser de første {FEEDBACK_LIST_LIMIT} rapporter. Brug filtrene for at se andre.
            </p>
          ) : null}
        </>
      )}
    </>
  );
}
