import type { Metadata } from "next";

import { SongForm } from "@/components/features/songs/song-form";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { songsHref } from "@/lib/routes";
import { requireSongAdminPage } from "@/server/songs/access";

export const metadata: Metadata = { title: "Tilføj sang" };

/**
 * Tilføj sang (SPEC §9.6, §5.1): admins only; a member gets a real 404.
 *
 * No loading.tsx above this page (TG-008, D-108), and the permission 404 comes
 * before the active club changes (D-066, D-089): requireMembership →
 * canManageSongs → rememberActiveClub. The Server Action checks again.
 */
export default async function NewSongPage({ params }: PageProps<"/c/[clubId]/songs/new">) {
  const { clubId } = await params;
  const { club } = await requireSongAdminPage(clubId);

  return (
    <>
      <PageHeader
        title="Tilføj sang"
        description="Skriv teksten med akkorderne på linjen over, så kan alle synge med."
      />
      <Card className="max-w-2xl">
        <CardContent>
          <SongForm
            clubId={club.id}
            defaults={{ title: "", artist: "", melody: "", body: "" }}
            cancelHref={songsHref(club.id)}
          />
        </CardContent>
      </Card>
    </>
  );
}
