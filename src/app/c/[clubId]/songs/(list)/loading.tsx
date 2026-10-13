import { SongListSkeleton } from "@/components/features/songs/song-skeletons";

/**
 * Loading state for Sangbog (SPEC §13.4). In the (list) group, so it does not
 * wrap songs/new or songs/[songId] (TG-008, TG-025, D-108).
 */
export default function SongsLoading() {
  return <SongListSkeleton />;
}
