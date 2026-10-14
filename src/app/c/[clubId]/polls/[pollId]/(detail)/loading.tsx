import { PollPageSkeleton } from "@/components/features/polls/poll-skeletons";

/**
 * Loading state for the poll page (SPEC §13.4). Below the guard layout
 * polls/[pollId]/layout.tsx, which already gave a real 404 for an unknown
 * poll, and inside the (detail) group, so it does not wrap edit/ (TG-008).
 * It is also the boundary a Link prefetch stops at, so the page's lazy close
 * only runs on a real navigation (D-052).
 */
export default function PollLoading() {
  return <PollPageSkeleton />;
}
