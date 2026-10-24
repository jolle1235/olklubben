"use client";

import { useDeferredValue, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FileUpIcon, MusicIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { importSongsHref, newSongHref, songsHref } from "@/lib/routes";
import {
  buildSongSearchIndex,
  matchSongs,
  SONG_SEARCH_MAX_LENGTH,
} from "@/server/domain/songs/search";
import { groupSongsByLetter } from "@/server/domain/songs/title";
import type { SongbookEntry } from "@/server/songs/queries";

import { SongAlphabetList } from "./song-alphabet-list";
import { SongFinderBar } from "./song-finder-bar";
import { SongSearchResults } from "./song-search-results";
import {
  SONGBOOK_LAST_SONG_KEY,
  SONGBOOK_LIST_URL_KEY,
  storeSession,
  takeSession,
} from "./songbook-session";

const URL_SYNC_MS = 300;

export type SongbookBrowserProps = {
  clubId: string;
  /** Every song of the club, sorted by the server (Danish book order). */
  entries: SongbookEntry[];
  /** Admin: the empty songbook offers "Tilføj sang". */
  canManage: boolean;
};

function listUrl(clubId: string, query: string): string {
  const q = query.trim().slice(0, SONG_SEARCH_MAX_LENGTH);
  return `${songsHref(clubId)}${q ? `?q=${encodeURIComponent(q)}` : ""}`;
}

function countLabel(count: number): string {
  return count === 1 ? "1 sang" : `${count} sange`;
}

/**
 * The songbook list (SPEC §9.6 "Oversigt"): every song in Danish order under
 * letter headings, and an instant search in title, artist, melody and lyrics
 * that runs in the browser (search.ts), so it keeps working when the wifi
 * drops. The same matcher renders ?q= on the server (deep link, refresh).
 *
 * The query is in the URL: read from useSearchParams (back/forward restore
 * it) and written with a debounced history.replaceState (no server round
 * trip, no history entry per keystroke), like the flash toast and the
 * calendar. The URL also goes to sessionStorage for "‹ Sangbog" in the reader.
 */
export function SongbookBrowser({ clubId, entries, canManage }: SongbookBrowserProps) {
  const searchParams = useSearchParams();
  const urlQuery = (searchParams.get("q") ?? "").slice(0, SONG_SEARCH_MAX_LENGTH);
  const [query, setQuery] = useState(urlQuery);
  // What this component last wrote; the URL is only adopted when it changes from elsewhere.
  const [written, setWritten] = useState(urlQuery.trim());
  const [previousUrlQuery, setPreviousUrlQuery] = useState(urlQuery);
  if (urlQuery !== previousUrlQuery) {
    setPreviousUrlQuery(urlQuery);
    if (urlQuery !== written) {
      setQuery(urlQuery);
      setWritten(urlQuery);
    }
  }
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  const deferredQuery = useDeferredValue(query);
  const index = useMemo(() => buildSongSearchIndex(entries), [entries]);
  const result = useMemo(() => matchSongs(index, deferredQuery), [index, deferredQuery]);
  const groups = useMemo(() => groupSongsByLetter(entries), [entries]);
  const letters = useMemo(() => new Set(groups.map((group) => group.letter)), [groups]);
  const entriesById = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
  const searching = result.mode !== "all";

  // Once per mount: later URL changes are this component's own.
  const onMount = useEffectEvent(() => {
    storeSession(SONGBOOK_LIST_URL_KEY, listUrl(clubId, urlQuery));
    // Back from a song: bring it into view if the scroll position was not restored.
    const lastSongId = takeSession(SONGBOOK_LAST_SONG_KEY);
    const row = lastSongId
      ? document.querySelector(`[data-song-id="${CSS.escape(lastSongId)}"]`)
      : null;
    if (row) {
      const { top, bottom } = row.getBoundingClientRect();
      if (top < 0 || bottom > window.innerHeight) row.scrollIntoView({ block: "center" });
    }
  });
  useEffect(() => {
    onMount();
    return () => clearTimeout(debounce.current);
  }, []);

  function writeUrl(value: string) {
    clearTimeout(debounce.current);
    const url = listUrl(clubId, value);
    setWritten(value.trim().slice(0, SONG_SEARCH_MAX_LENGTH));
    // Native history calls are synced with Next's router (no server request).
    window.history.replaceState(null, "", url);
    storeSession(SONGBOOK_LIST_URL_KEY, url);
  }

  function changeQuery(value: string) {
    setQuery(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => writeUrl(value), URL_SYNC_MS);
  }

  function clear() {
    setQuery("");
    writeUrl("");
  }

  const rememberOpened = (id: string) => storeSession(SONGBOOK_LAST_SONG_KEY, id);

  if (entries.length === 0) return <EmptySongbook clubId={clubId} canManage={canManage} />;

  return (
    <div className="grid grid-cols-1 gap-4 md:max-w-2xl">
      <SongFinderBar
        action={songsHref(clubId)}
        query={query}
        onQueryChange={changeQuery}
        onSubmit={() => writeUrl(query)}
        onClear={clear}
        letters={searching ? null : letters}
      />

      <p
        role="status"
        className={
          searching && result.matches.length > 0
            ? "text-[0.95rem] text-muted-foreground"
            : "sr-only"
        }
      >
        {searching
          ? result.matches.length > 0
            ? countLabel(result.matches.length)
            : "Ingen sange matcher søgningen"
          : ""}
      </p>

      {searching ? (
        <SongSearchResults
          clubId={clubId}
          query={deferredQuery}
          result={result}
          entriesById={entriesById}
          clearHref={songsHref(clubId)}
          onClear={clear}
          onOpen={rememberOpened}
        />
      ) : (
        <SongAlphabetList clubId={clubId} groups={groups} onOpen={rememberOpened} />
      )}
    </div>
  );
}

function EmptySongbook({ clubId, canManage }: { clubId: string; canManage: boolean }) {
  return (
    <EmptyState
      icon={<MusicIcon />}
      title="Sangbogen er tom endnu 🎵"
      description={
        canManage
          ? "Skriv klubbens første sang ind, eller importér hele sangbogen fra PDF'er."
          : "Når en admin har lagt sangene ind, finder I dem her – også midt i smagningen."
      }
      actions={
        canManage ? (
          <>
            <Button asChild size="lg">
              <Link href={newSongHref(clubId)}>
                <PlusIcon aria-hidden />
                Tilføj sang
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={importSongsHref(clubId)}>
                <FileUpIcon aria-hidden />
                Importér fra PDF
              </Link>
            </Button>
          </>
        ) : undefined
      }
    />
  );
}
