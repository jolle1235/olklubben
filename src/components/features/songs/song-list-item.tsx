import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";

import type { HighlightRange, SongSnippet as SongSnippetData } from "@/server/domain/songs/search";

import { Highlighted, SongSnippet } from "./song-snippet";

export type SongListItemProps = {
  id: string;
  title: string;
  artist: string | null;
  melody: string | null;
  href: string;
  /** Search hits in the title / artist (highlightRanges). */
  titleMarks?: readonly HighlightRange[];
  artistMarks?: readonly HighlightRange[];
  /** The lyric line that matched (rank 4–5 hits). */
  snippet?: SongSnippetData | null;
  /** Called on open (the list remembers the song to scroll back to it). */
  onOpen?: (id: string) => void;
};

/**
 * One song in the songbook list (SPEC §9.6): the whole row is the link, at
 * least 60 px tall. The title, then the artist (or "Mel.: …"), and for a
 * lyric hit the matching line. Rows sit in a rounded overflow-hidden card, so
 * the focus ring is drawn inside (F-029).
 */
export function SongListItem({
  id,
  title,
  artist,
  melody,
  href,
  titleMarks,
  artistMarks,
  snippet,
  onOpen,
}: SongListItemProps) {
  return (
    <li data-song-id={id}>
      <Link
        href={href}
        onClick={onOpen ? () => onOpen(id) : undefined}
        className="flex min-h-15 items-center gap-3 px-4 py-2.5 text-ink transition-colors hover:bg-olive-tint/50 focus-visible:-outline-offset-3 sm:px-5"
      >
        <span className="grid min-w-0 flex-1 grid-cols-1">
          <span className="text-[1.125rem] leading-snug font-semibold break-words hyphens-auto">
            <Highlighted text={title} marks={titleMarks} />
          </span>
          {artist ? (
            <span className="text-[0.95rem] break-words hyphens-auto text-slate">
              <Highlighted text={artist} marks={artistMarks} />
            </span>
          ) : melody ? (
            <span className="text-[0.95rem] break-words hyphens-auto text-slate">
              Mel.: {melody}
            </span>
          ) : null}
          {snippet ? <SongSnippet text={snippet.text} marks={snippet.marks} /> : null}
        </span>
        <ChevronRightIcon aria-hidden className="size-5 shrink-0 text-slate" />
      </Link>
    </li>
  );
}

/** The card the rows sit in: paper, rounded, dividers between rows. */
export function SongListCard({ children }: { children: React.ReactNode }) {
  return (
    <ul className="grid grid-cols-1 divide-y divide-cream-deep overflow-hidden rounded-2xl border border-border bg-paper">
      {children}
    </ul>
  );
}
