import { BeerFormSkeleton } from "@/components/features/beers/beer-skeletons";

/**
 * Loading state for Tilføj øl (SPEC §13.4). The page never calls notFound()
 * itself (an unknown ?eventId= is ignored), so this boundary is safe (TG-008).
 */
export default function NewBeerLoading() {
  return <BeerFormSkeleton />;
}
