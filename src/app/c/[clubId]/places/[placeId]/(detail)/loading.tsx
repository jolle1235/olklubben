import { PlaceDetailSkeleton } from "@/components/features/places/place-skeletons";

/**
 * Loading state for a place's page (SPEC §13.4). Below the guard layout
 * places/[placeId]/layout.tsx, which already gave a real 404 for an unknown
 * place, and inside the (detail) group, so it does not wrap edit/ (TG-008,
 * D-108).
 */
export default function PlaceLoading() {
  return <PlaceDetailSkeleton />;
}
