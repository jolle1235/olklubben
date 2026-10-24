import type { Metadata } from "next";

import { SongPdfImport } from "@/components/features/songs/song-pdf-import";
import { PageHeader } from "@/components/ui/page-header";
import { requireSongAdminPage } from "@/server/songs/access";

export const metadata: Metadata = { title: "Importér sange" };

/**
 * Importér fra PDF (SPEC §9.6, D-156): admins only; a member gets a real 404,
 * like Tilføj sang (requireMembership → canManageSongs → rememberActiveClub).
 * Both Server Actions check again.
 */
export default async function ImportSongsPage({ params }: PageProps<"/c/[clubId]/songs/import">) {
  const { clubId } = await params;
  const { club } = await requireSongAdminPage(clubId);

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
