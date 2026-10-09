import { BeerDetailSkeleton } from "@/components/features/beers/beer-skeletons";

/**
 * Loading state for the beer page (SPEC §13.4). Below the guard layout
 * beers/[beerId]/layout.tsx, which already gave a real 404 for an unknown
 * beer, and inside the (detail) group, so it does not wrap edit/ (TG-008).
 */
export default function BeerLoading() {
  return <BeerDetailSkeleton />;
}
