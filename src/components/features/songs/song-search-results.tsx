import Link from "next/link";
import { SearchXIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { songHref } from "@/lib/routes";
import { highlightRanges, type SongSearchResult } from "@/server/domain/songs/search";

import { SongListCard, SongListItem } from "./song-list-item";

/** What a result row shows of a song. */
export type SongResultEntry = {
  id: string;
  title: string;
  artist: string | null;
  melody: string | null;
};

export type SongSearchResultsProps = {
  clubId: string;
  query: string;
  result: SongSearchResult;
  entriesById: ReadonlyMap<string, SongResultEntry>;
  /** "Ryd søgning" in the no-hits state (a plain link to the list before hydration). */
  clearHref: string;
  onClear: () => void;
  onOpen: (id: string) => void;
};

/**
 * The songbook's search view (SPEC §9.6): hits in the title, artist or melody
 * first, then "Fundet i teksten" with the matching line. In loose mode
 * (nothing matched exactly) a note says æ, ø and å were ignored.
 */
export function SongSearchResults({
  clubId,
  query,
  result,
  entriesById,
  clearHref,
  onClear,
  onOpen,
}: SongSearchResultsProps) {
  if (result.matches.length === 0) {
    return (
      <EmptyState
        icon={<SearchXIcon />}
        title={
          <>
            Ingen sange matcher „<span className="wrap-anywhere">{query.trim()}</span>“
          </>
        }
        description="Prøv et enkelt ord fra titlen eller en linje, du kan huske."
        className="py-8 md:py-10"
        actions={
          <Button asChild variant="outline">
            <Link
              href={clearHref}
              onClick={(event) => {
                event.preventDefault();
                onClear();
              }}
            >
              Ryd søgning
            </Link>
          </Button>
        }
      />
    );
  }

  const mode = result.mode;
  const rows = (matches: SongSearchResult["matches"]) =>
    matches.flatMap((match) => {
      const entry = entriesById.get(match.id);
      if (!entry) return [];
      return [
        <SongListItem
          key={entry.id}
          id={entry.id}
          title={entry.title}
          artist={entry.artist}
          melody={entry.melody}
          href={songHref(clubId, entry.id)}
          titleMarks={highlightRanges(entry.title, query, mode)}
          artistMarks={entry.artist ? highlightRanges(entry.artist, query, mode) : undefined}
          snippet={match.snippet}
          onOpen={onOpen}
        />,
      ];
    });
  const titleHits = result.matches.filter((match) => match.rank < 4);
  const lyricHits = result.matches.filter((match) => match.rank >= 4);

  return (
    <div className="grid grid-cols-1 gap-4">
      {mode === "loose" ? (
        <p className="rounded-xl bg-harbor-tint px-4 py-3 text-[0.95rem] text-ink">
          Ingen præcise træf. Her er sange, hvis man ser bort fra æ, ø og å.
        </p>
      ) : null}
      {titleHits.length > 0 ? <SongListCard>{rows(titleHits)}</SongListCard> : null}
      {lyricHits.length > 0 ? (
        <section aria-labelledby="fundet-i-teksten" className="grid grid-cols-1 gap-2">
          <h2 id="fundet-i-teksten" className="text-xl text-olive">
            Fundet i teksten
          </h2>
          <SongListCard>{rows(lyricHits)}</SongListCard>
        </section>
      ) : null}
    </div>
  );
}
