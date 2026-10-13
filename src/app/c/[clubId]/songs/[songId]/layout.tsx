import { requireSong } from "@/server/songs/access";

/**
 * Guard for every page of one song (SPEC §4.4, D-065, TG-025): membership and
 * the song in THIS club, else a real HTTP 404 – unknown, malformed and
 * other-club ids alike (E22). It sits above the (detail) loading boundary, so
 * notFound() runs before the response starts streaming.
 *
 * Never writes: a Link prefetch renders layouts down to the nearest
 * loading.tsx (D-052). The pages call requireSongPage() (reader) or
 * requireSong → canManageSongs → rememberActiveClub (edit), which share the
 * cached query.
 */
export default async function SongLayout({
  children,
  params,
}: LayoutProps<"/c/[clubId]/songs/[songId]">) {
  const { clubId, songId } = await params;
  await requireSong(clubId, songId);
  return children;
}
