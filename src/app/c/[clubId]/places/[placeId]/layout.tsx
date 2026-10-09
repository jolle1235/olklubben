import { requirePlace } from "@/server/places/access";

/**
 * Guard for every page of one place (SPEC §4.4, D-065, D-108): membership and
 * the place in THIS club, else a real HTTP 404 – unknown, malformed and
 * other-club ids alike (E22). Archived places are found too (§9.4: their
 * events still link to them). It sits above the (detail) loading boundary, so
 * notFound() runs before the response starts streaming.
 *
 * Never writes: a Link prefetch renders layouts down to the nearest
 * loading.tsx (D-052). The pages call requirePlacePage() (detail) or
 * requirePlace → canEditPlace → rememberActiveClub (edit), which share the
 * cached queries.
 *
 * FINAL (round-3 foundation); feature agents do not change it.
 */
export default async function PlaceLayout({
  children,
  params,
}: LayoutProps<"/c/[clubId]/places/[placeId]">) {
  const { clubId, placeId } = await params;
  await requirePlace(clubId, placeId);
  return children;
}
