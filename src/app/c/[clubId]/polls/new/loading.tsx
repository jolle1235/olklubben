import { PollFormSkeleton } from "@/components/features/polls/poll-skeletons";

/**
 * Loading state for "Planlæg ølsmagning" (SPEC §13.4). The page never calls
 * notFound() itself, so this boundary cannot turn a 404 soft (TG-008).
 */
export default function NewPollLoading() {
  return <PollFormSkeleton />;
}
