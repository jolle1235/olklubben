import { EventFormSkeleton } from "@/components/features/events/event-skeletons";

/**
 * Loading state for Opret event (SPEC §13.4). The page never calls notFound()
 * itself, so this boundary cannot turn a 404 soft (TG-008).
 */
export default function NewEventLoading() {
  return <EventFormSkeleton />;
}
