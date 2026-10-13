import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { TopBarAction } from "@/components/features/app-shell";
import { SongbookBrowser } from "@/components/features/songs/songbook-browser";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { newSongHref } from "@/lib/routes";
import { requireClubPage } from "@/server/auth/session";
import { canManageSongs } from "@/server/domain/songs/permissions";
import { listSongbook } from "@/server/songs/queries";

export const metadata: Metadata = { title: "Sangbog" };

function songCountLabel(count: number): string | undefined {
  if (count === 0) return undefined;
  return count === 1 ? "1 sang" : `${count} sange fra A til Å`;
}

/**
 * Sangbog (SPEC §9.6): every song of the club in Danish book order, with
 * instant search in title, artist, melody and lyrics (SongbookBrowser).
 *
 * A list that never calls notFound() itself, so its loading.tsx may sit next
 * to it. Both live in the (list) route group, so the boundary does not wrap
 * songs/new or songs/[songId] (TG-008, TG-025, D-108).
 */
export default async function SongsPage({ params }: PageProps<"/c/[clubId]/songs">) {
  const { clubId } = await params;
  const { membership, club } = await requireClubPage(clubId);
  const entries = await listSongbook(club.id);
  const canManage = canManageSongs(membership);
  const addHref = newSongHref(club.id);

  return (
    <>
      {canManage ? (
        <TopBarAction>
          <Button asChild size="icon" variant="brass">
            <Link href={addHref} aria-label="Tilføj sang">
              <PlusIcon aria-hidden />
            </Link>
          </Button>
        </TopBarAction>
      ) : null}

      <PageHeader
        title="Sangbog"
        description={songCountLabel(entries.length)}
        action={
          canManage && entries.length > 0 ? (
            <Button asChild className="hidden md:inline-flex">
              <Link href={addHref}>
                <PlusIcon aria-hidden />
                Tilføj sang
              </Link>
            </Button>
          ) : undefined
        }
      />

      <SongbookBrowser clubId={club.id} entries={entries} canManage={canManage} />
    </>
  );
}
