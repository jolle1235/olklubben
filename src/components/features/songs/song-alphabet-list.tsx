import { songHref } from "@/lib/routes";
import { letterAnchorId, type SongbookLetter } from "@/server/domain/songs/title";

import { SongListCard, SongListItem } from "./song-list-item";

export type SongAlphabetGroup = {
  letter: SongbookLetter;
  songs: { id: string; title: string; artist: string | null; melody: string | null }[];
};

export type SongAlphabetListProps = {
  clubId: string;
  /** groupSongsByLetter of the book-ordered songs. */
  groups: SongAlphabetGroup[];
  onOpen: (id: string) => void;
};

/**
 * The songbook without a search (SPEC §9.6): one section per letter, # first
 * and Æ Ø Å last. The headings are the A–Å grid's jump targets
 * (#bogstav-…); not sticky, but their scroll margin clears the top bar and
 * the finder bar.
 */
export function SongAlphabetList({ clubId, groups, onOpen }: SongAlphabetListProps) {
  return (
    <div className="grid grid-cols-1 gap-6">
      {groups.map(({ letter, songs }) => (
        <section
          key={letter}
          aria-labelledby={letterAnchorId(letter)}
          className="grid grid-cols-1 gap-2"
        >
          <h2
            id={letterAnchorId(letter)}
            tabIndex={-1}
            className="scroll-mt-[calc(8.5rem+env(safe-area-inset-top))] px-1 font-heading text-2xl leading-none text-amber-ink outline-offset-4 md:scroll-mt-24"
          >
            {letter === "#" ? (
              <>
                <span aria-hidden>#</span>
                <span className="sr-only">Tal og tegn</span>
              </>
            ) : (
              letter
            )}
          </h2>
          <SongListCard>
            {songs.map((song) => (
              <SongListItem
                key={song.id}
                id={song.id}
                title={song.title}
                artist={song.artist}
                melody={song.melody}
                href={songHref(clubId, song.id)}
                onOpen={onOpen}
              />
            ))}
          </SongListCard>
        </section>
      ))}
    </div>
  );
}
