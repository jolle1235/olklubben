import type { Metadata } from "next";
import Link from "next/link";
import { PencilIcon } from "lucide-react";

import { TopBarAction } from "@/components/features/app-shell";
import { BackToSongbook } from "@/components/features/songs/back-to-songbook";
import { DeleteSongButton } from "@/components/features/songs/delete-song-button";
import { SongFontStepper } from "@/components/features/songs/song-font-stepper";
import { SongNeighboursNav } from "@/components/features/songs/song-neighbours-nav";
import { SongReader } from "@/components/features/songs/song-reader";
import { SongTextView } from "@/components/features/songs/song-text-view";
import { SongViewToggle } from "@/components/features/songs/song-view-toggle";
import { Button } from "@/components/ui/button";
import { LinkPendingIcon } from "@/components/ui/link-pending";
import { RopeDivider } from "@/components/ui/rope-divider";
import { editSongHref, songHref } from "@/lib/routes";
import { canManageSongs } from "@/server/domain/songs/permissions";
import { hasChords } from "@/server/domain/songs/song-text";
import { songNeighbours } from "@/server/domain/songs/title";
import { requireSong, requireSongPage } from "@/server/songs/access";
import { listSongTitles } from "@/server/songs/queries";

export async function generateMetadata({
  params,
}: PageProps<"/c/[clubId]/songs/[songId]">): Promise<Metadata> {
  const { clubId, songId } = await params;
  // Cached with the guard layout's call; never writes.
  const { song } = await requireSong(clubId, songId);
  return { title: song.title };
}

/**
 * One song in the reader (SPEC §9.6): Tekst | Akkorder, font size (in the
 * mobile top bar, in the toolbar from md), the screen kept on, and
 * Forrige/Næste through the whole book in Danish order. Admins edit and
 * delete at the bottom (D-080).
 *
 * The guard layout has already given a real 404 for a song that is not in this
 * club (E22); requireSongPage() returns it and remembers the active club.
 */
export default async function SongPage({ params }: PageProps<"/c/[clubId]/songs/[songId]">) {
  const { clubId, songId } = await params;
  const { membership, club, song } = await requireSongPage(clubId, songId);
  // After the guard and with the verified club id, like the other pages.
  const titles = await listSongTitles(club.id);
  const { previous, next } = songNeighbours(titles, song.id);
  const canManage = canManageSongs(membership);
  const withChords = hasChords(song.body);
  const neighbour = (ref: { id: string; title: string } | null) =>
    ref ? { title: ref.title, href: songHref(club.id, ref.id) } : null;

  return (
    <SongReader>
      <TopBarAction>
        <SongFontStepper variant="topbar" />
      </TopBarAction>

      <div className="mb-3">
        <BackToSongbook clubId={club.id} />
      </div>

      <header className="mb-5 grid grid-cols-1 gap-1.5">
        <h1 className="text-3xl leading-[1.1] font-bold tracking-tight break-words hyphens-auto text-olive md:text-4xl">
          {song.title}
        </h1>
        {song.artist ? (
          <p className="text-[1.125rem] break-words hyphens-auto text-slate">{song.artist}</p>
        ) : null}
        {song.melody ? (
          <p className="break-words hyphens-auto text-slate italic">Mel.: {song.melody}</p>
        ) : null}
      </header>

      {withChords ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 md:justify-start md:gap-6">
          <SongViewToggle />
          <SongFontStepper variant="toolbar" className="hidden md:flex" />
        </div>
      ) : (
        <div className="mb-6 hidden md:flex">
          <SongFontStepper variant="toolbar" />
        </div>
      )}

      <SongTextView body={song.body} className="max-w-[40rem]" />

      <RopeDivider className="my-8 md:my-10" />

      <SongNeighboursNav previous={neighbour(previous)} next={neighbour(next)} />

      {canManage ? (
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href={editSongHref(club.id, song.id)}>
              <LinkPendingIcon icon={<PencilIcon aria-hidden />} />
              Rediger sang
            </Link>
          </Button>
          <DeleteSongButton clubId={club.id} songId={song.id} title={song.title} />
        </div>
      ) : null}
    </SongReader>
  );
}
