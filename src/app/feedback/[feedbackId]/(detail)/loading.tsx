import { FeedbackDetailSkeleton } from "@/components/features/feedback/feedback-skeletons";

/**
 * Loading state for a report's page (SPEC §13.4). Below the guard layout
 * feedback/[feedbackId]/layout.tsx, which already gave a real 404 for an
 * unknown report, and inside the (detail) group, so it does not wrap edit/
 * (D-065, D-148).
 */
export default function FeedbackLoading() {
  return <FeedbackDetailSkeleton />;
}
