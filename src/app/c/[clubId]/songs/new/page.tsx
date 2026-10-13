import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SongForm } from "@/components/features/songs/song-form";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { songsHref } from "@/lib/routes";
import { rememberActiveClub, requireMembership } from "@/server/auth/session";
import { canManageSongs } from "@/server/domain/songs/permissions";

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
  const { user, membership, club } = await requireMembership(clubId);
  if (!canManageSongs(membership)) notFound();
  await rememberActiveClub(user, club.id);

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
