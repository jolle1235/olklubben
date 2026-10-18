import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { feedbackListHref } from "@/lib/routes";

/**
 * 404 inside the feedback pages (SPEC §9.9, §13.5, D-148): an unknown or
 * malformed report id, a report deleted meanwhile, or an edit page the viewer
 * may not use. Rendered inside the feedback layout (AppShell or FeedbackShell),
 * with the way back to the list.
 */
export default function FeedbackNotFound() {
  return (
    <EmptyState
      as="h1"
      icon={<span className="font-display text-xl font-bold text-amber-ink">404</span>}
      title="Den her øl er vist drukket."
      description="Rapporten findes ikke. Måske er den slettet, eller også er linket gammelt."
      actions={
        <Button asChild>
          <Link href={feedbackListHref()}>Til feedbacklisten</Link>
        </Button>
      }
    />
  );
}
