import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SongForm } from "@/components/features/songs/song-form";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { songHref } from "@/lib/routes";
import { rememberActiveClub } from "@/server/auth/session";
import { canManageSongs } from "@/server/domain/songs/permissions";
import { requireSong } from "@/server/songs/access";

export const metadata: Metadata = { title: "Rediger sang" };

/**
 * Rediger sang (SPEC §9.6, §5.1): admins only; a member gets a real 404.
 *
 * No loading.tsx above this page (TG-008, D-108). The guard layout has already
 * checked that the song is in this club; the order is requireSong →
 * canManageSongs → rememberActiveClub (D-066, D-089), so a permission 404
 * never changes the active club. The Server Action checks again.
 */
export default async function EditSongPage({
  params,
}: PageProps<"/c/[clubId]/songs/[songId]/edit">) {
  const { clubId, songId } = await params;
  const { user, membership, club, song } = await requireSong(clubId, songId);
  if (!canManageSongs(membership)) notFound();
  await rememberActiveClub(user, club.id);

  return (
    <>
      <PageHeader
        title="Rediger sang"
        description={<span className="break-words hyphens-auto">{song.title}</span>}
      />
      <Card className="max-w-2xl">
        <CardContent>
          <SongForm
            clubId={club.id}
            songId={song.id}
            defaults={{
              title: song.title,
              artist: song.artist ?? "",
              melody: song.melody ?? "",
              body: song.body,
            }}
            cancelHref={songHref(club.id, song.id)}
          />
        </CardContent>
      </Card>
    </>
  );
}
