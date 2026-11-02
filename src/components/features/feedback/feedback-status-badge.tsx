import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FEEDBACK_STATUS_LABELS, type FeedbackStatus } from "@/server/domain/feedback/status";

/**
 * Colour-system roles only (§13.2); every pair is WCAG AA in both themes
 * (src/styles/tokens/contrast.test.ts).
 */
const STATUS_CLASSES: Record<FeedbackStatus, string> = {
  NEW: "bg-info-subtle text-info-ink",
  PLANNED: "bg-highlight-subtle text-foreground",
  IN_PROGRESS: "bg-highlight text-highlight-foreground",
  DONE: "bg-success-subtle text-success-ink",
  WONT_DO: "bg-muted text-muted-foreground",
  DUPLICATE: "border-border bg-card text-muted-foreground",
};

/** A report's status as a small pill ("Ny", "Planlagt", "Færdig ✓" …), SPEC §9.9. */
export function FeedbackStatusBadge({
  status,
  className,
}: {
  status: FeedbackStatus;
  className?: string;
}) {
  return (
    <Badge className={cn(STATUS_CLASSES[status], className)}>
      {FEEDBACK_STATUS_LABELS[status]}
    </Badge>
  );
}
