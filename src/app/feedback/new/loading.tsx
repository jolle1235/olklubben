import { FeedbackFormSkeleton } from "@/components/features/feedback/feedback-skeletons";

/** Loading state for "Ny rapport" (SPEC §13.4). The page never 404s itself (D-065). */
export default function NewFeedbackLoading() {
  return <FeedbackFormSkeleton />;
}
