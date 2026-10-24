import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SongPdfImport } from "@/components/features/songs/song-pdf-import";
import { PageHeader } from "@/components/ui/page-header";
import { rememberActiveClub, requireMembership } from "@/server/auth/session";
import { canManageSongs } from "@/server/domain/songs/permissions";

export const metadata: Metadata = { title: "Importér sange" };

/**
 * Importér fra PDF (SPEC §9.6, D-156): admins only; a member gets a real 404,
 * like Tilføj sang (requireMembership → canManageSongs → rememberActiveClub).
 * Both Server Actions check again.
 */
export default async function ImportSongsPage({ params }: PageProps<"/c/[clubId]/songs/import">) {
  const { clubId } = await params;
  const { user, membership, club } = await requireMembership(clubId);
  if (!canManageSongs(membership)) notFound();
  await rememberActiveClub(user, club.id);

  return (
    <>
      <PageHeader
        title="Importér sange"
        description="Læg klubbens sangbog ind fra PDF'er – du ser og retter hver sang, før den kommer med."
      />
      <div className="max-w-3xl">
        <SongPdfImport clubId={club.id} />
      </div>
    </>
  );
}
