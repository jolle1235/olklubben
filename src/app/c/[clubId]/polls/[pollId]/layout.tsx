import { requirePoll } from "@/server/polls/access";

/**
 * Guard for every page of one poll (SPEC §4.4, D-065, TG-008): membership and
 * the poll in THIS club, else a real HTTP 404 – unknown, malformed and
 * other-club ids alike (E22). It sits above the (detail) loading boundary, so
 * notFound() runs before the response starts streaming.
 *
 * Never writes – no lazy close, no active club (D-052): a Link prefetch
 * renders layouts down to the nearest loading.tsx. The pages call
 * requirePollPage() / requirePoll(), which share the cached queries.
 */
export default async function PollLayout({
  children,
  params,
}: LayoutProps<"/c/[clubId]/polls/[pollId]">) {
  const { clubId, pollId } = await params;
  await requirePoll(clubId, pollId);
  return children;
}
