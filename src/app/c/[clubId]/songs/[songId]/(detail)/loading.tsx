import { SongReaderSkeleton } from "@/components/features/songs/song-skeletons";

/**
 * Loading state for one song (SPEC §13.4). Below the guard layout
 * songs/[songId]/layout.tsx, which already gave a real 404 for an unknown
 * song, and inside the (detail) group, so it does not wrap edit/ (TG-008,
 * TG-025, D-108).
 */
export default function SongLoading() {
  return <SongReaderSkeleton />;
}
