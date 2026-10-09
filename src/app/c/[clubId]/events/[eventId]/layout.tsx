import { requireEvent } from "@/server/events/access";

/**
 * Guard for every page of one event (SPEC §4.4, TG-008): membership and the
 * event in THIS club, else a real HTTP 404 – unknown, malformed and
 * other-club ids alike (E22). It sits above the (detail) loading boundary, so
 * notFound() runs before the response starts streaming.
 *
 * Never writes: a Link prefetch renders layouts down to the nearest
 * loading.tsx (D-052). The pages call requireEventPage(), which shares the
 * cached queries and remembers the active club.
 */
export default async function EventLayout({
  children,
  params,
}: LayoutProps<"/c/[clubId]/events/[eventId]">) {
  const { clubId, eventId } = await params;
  await requireEvent(clubId, eventId);
  return children;
}
