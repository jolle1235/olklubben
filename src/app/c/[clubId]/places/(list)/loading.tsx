import { PlacesListSkeleton } from "@/components/features/places/place-skeletons";

/**
 * Loading state for Steder (SPEC §13.4), shaped like the place cards. In the
 * (list) group, so it does not wrap places/new or places/[placeId] (TG-008,
 * D-108).
 */
export default function PlacesLoading() {
  return <PlacesListSkeleton />;
}
