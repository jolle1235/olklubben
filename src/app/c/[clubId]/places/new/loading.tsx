import { PageSkeleton } from "@/components/features/page-skeleton";

/** Loading state for "Nyt sted" (SPEC §13.4). The page never 404s itself (TG-008). */
export default function NewPlaceLoading() {
  return <PageSkeleton label="Henter formularen …" />;
}
