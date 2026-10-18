import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FEEDBACK_STATUS_LABELS, type FeedbackStatus } from "@/server/domain/feedback/status";

/**
 * Brand tokens only (§13.2, D-092), every pair WCAG AA (globals.css): harbor
 * on harbor-tint 6,14 · ink on amber-tint 13,34 · ink on amber 6,92 ·
 * olive-deep on olive-tint 10,83 · slate on cream-deep 4,64 / paper 5,64.
 */
const STATUS_CLASSES: Record<FeedbackStatus, string> = {
  NEW: "bg-harbor-tint text-harbor",
  PLANNED: "bg-amber-tint text-ink",
  IN_PROGRESS: "bg-amber text-ink",
  DONE: "bg-olive-tint text-olive-deep",
  WONT_DO: "bg-cream-deep text-slate",
  DUPLICATE: "border-border bg-paper text-slate",
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
