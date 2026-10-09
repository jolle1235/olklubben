import { BeerCatalogSkeleton } from "@/components/features/beers/beer-skeletons";

/**
 * Loading state for Ølkatalog (SPEC §13.4). Inside the (catalog) group, so it
 * does not wrap beers/new or beers/[beerId] (their notFound() must stay a real
 * 404, TG-008).
 */
export default function BeerCatalogLoading() {
  return <BeerCatalogSkeleton />;
}
