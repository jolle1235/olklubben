import { FeedbackListSkeleton } from "@/components/features/feedback/feedback-skeletons";

/**
 * Loading state for the feedback list (SPEC §13.4). In the (list) group, so
 * it does not wrap feedback/new or a report's page (D-065, D-148).
 */
export default function FeedbackListLoading() {
  return <FeedbackListSkeleton />;
}
