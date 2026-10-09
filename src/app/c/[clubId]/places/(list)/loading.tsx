import { PageSkeleton } from "@/components/features/page-skeleton";

/**
 * Loading state for Steder (SPEC §13.4). In the (list) group, so it does not
 * wrap places/new or places/[placeId] (TG-008, D-108). Agent B may replace
 * PageSkeleton with a skeleton shaped like the place cards.
 */
export default function PlacesLoading() {
  return <PageSkeleton label="Henter stederne …" />;
}
