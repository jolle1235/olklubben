"use client";

import { useEffect, useId, useRef } from "react";
import { SearchIcon, XIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SONG_SEARCH_MAX_LENGTH } from "@/server/domain/songs/search";
import type { SongbookLetter } from "@/server/domain/songs/title";

import { SongLetterGrid } from "./song-letter-grid";

export type SongFinderBarProps = {
  /** The songbook's path (the GET form's action before hydration). */
  action: string;
  query: string;
  onQueryChange: (query: string) => void;
  /** Enter: apply the search now (and close the keyboard). */
  onSubmit: () => void;
  onClear: () => void;
  /** The letters with songs. Null hides "A–Å" (while a search is active). */
  letters: ReadonlySet<SongbookLetter> | null;
};

/** True when focus is in a field, so "/" types instead of jumping to the search. */
function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest("input, textarea, select") !== null)
  );
}

/**
 * The songbook's sticky finder bar (SPEC §9.6): search in title, artist,
 * melody and lyrics, plus the A–Å jump grid. Sticks under the mobile top bar
 * (top-0 on md and up). A GET form, so a search works before hydration; with
 * JavaScript the browser filters as you type (SongbookBrowser), Enter closes
 * the keyboard, and on desktop "/" focuses the field.
 */
export function SongFinderBar({
  action,
  query,
  onQueryChange,
  onSubmit,
  onClear,
  letters,
}: SongFinderBarProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.altKey || event.ctrlKey || event.metaKey) return;
      if (isTyping(event.target)) return;
      event.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-20 -mx-4 border-b border-border bg-cream px-4 py-2 sm:-mx-6 sm:px-6 md:top-0 md:mx-0 md:px-0 md:py-3">
      <form
        role="search"
        aria-label="Sangbogen"
        method="get"
        action={action}
        onSubmit={(event) => {
          event.preventDefault();
          inputRef.current?.blur();
          onSubmit();
        }}
        className="flex items-center gap-2"
      >
        <div className="relative min-w-0 flex-1">
          <label htmlFor={inputId} className="sr-only">
            Søg i sangbogen
          </label>
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-slate"
          />
          <Input
            ref={inputRef}
            id={inputId}
            type="search"
            name="q"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Titel, kunstner eller en linje…"
            autoComplete="off"
            enterKeyHint="search"
            spellCheck={false}
            maxLength={SONG_SEARCH_MAX_LENGTH}
            className={cn(
              "h-12 pl-11 [&::-webkit-search-cancel-button]:appearance-none",
              query === "" ? "pr-3" : "pr-12",
            )}
          />
          {query !== "" ? (
            <button
              type="button"
              aria-label="Ryd søgning"
              onClick={() => {
                onClear();
                inputRef.current?.focus();
              }}
              className="absolute top-1/2 right-0.5 grid size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-slate hover:text-ink"
            >
              <XIcon aria-hidden className="size-5" />
            </button>
          ) : null}
        </div>
        {letters ? <SongLetterGrid available={letters} /> : null}
      </form>
    </div>
  );
}
