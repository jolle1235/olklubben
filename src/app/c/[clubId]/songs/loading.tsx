import { PageSkeleton } from "@/components/features/page-skeleton";

/**
 * Loading state for Sangbog (SPEC §13.4). Round 3 adds songs/[songId]: give
 * the list a (list) group then, like beers/(catalog), so this file does not
 * wrap the song pages (TG-008). Feature pages may replace PageSkeleton with a
 * skeleton shaped like their content.
 */
export default function SongsLoading() {
  return <PageSkeleton label="Henter sangbogen …" />;
}
