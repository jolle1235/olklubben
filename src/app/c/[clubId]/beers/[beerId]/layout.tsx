import { requireBeer } from "@/server/beers/access";

/**
 * Guard for every page of one beer (SPEC §4.4, TG-008): membership and the
 * beer in THIS club, else a real HTTP 404 – unknown, malformed and other-club
 * ids alike (E22). It sits above the (detail) loading boundary, so notFound()
 * runs before the response starts streaming.
 *
 * Never writes: a Link prefetch renders layouts down to the nearest
 * loading.tsx (D-052). The pages call requireBeerPage(), which shares the
 * cached queries and remembers the active club.
 */
export default async function BeerLayout({
  children,
  params,
}: LayoutProps<"/c/[clubId]/beers/[beerId]">) {
  const { clubId, beerId } = await params;
  await requireBeer(clubId, beerId);
  return children;
}
