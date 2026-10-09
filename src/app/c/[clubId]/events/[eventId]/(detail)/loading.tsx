import { EventDetailSkeleton } from "@/components/features/events/event-skeletons";

/**
 * Loading state for the event page (SPEC §13.4). Below the guard layout
 * events/[eventId]/layout.tsx, which already gave a real 404 for an unknown
 * event, and inside the (detail) group, so it does not wrap edit/ (TG-008).
 */
export default function EventLoading() {
  return <EventDetailSkeleton />;
}
