"use client";

import { cn } from "@/lib/utils";
import type { SongView } from "@/lib/songbook-prefs";

import { setSongView, useHydrated, useSongView } from "./use-songbook-prefs";

const VIEWS: { view: SongView; label: string }[] = [
  { view: "lyrics", label: "Tekst" },
  { view: "chords", label: "Akkorder" },
];

/**
 * Tekst | Akkorder (SPEC §9.6). Remembered per device. Both views are already
 * on the page (SongTextView); this only flips <html data-song-view>. Disabled
 * until hydrated (TG-020). Rendered only for songs with chords.
 */
export function SongViewToggle({ className }: { className?: string }) {
  const view = useSongView();
  const hydrated = useHydrated();

  return (
    <div
      role="group"
      aria-label="Visning"
      className={cn(
        "inline-flex h-11 shrink-0 overflow-hidden rounded-lg border border-olive bg-paper",
        className,
      )}
    >
      {VIEWS.map((option) => {
        const pressed = hydrated && option.view === view;
        return (
          <button
            key={option.view}
            type="button"
            aria-pressed={pressed}
            disabled={!hydrated}
            onClick={() => setSongView(option.view)}
            className={cn(
              "min-w-11 cursor-pointer px-4 text-base font-semibold transition-colors focus-visible:-outline-offset-4 disabled:cursor-default",
              pressed ? "bg-olive text-cream" : "text-olive hover:bg-olive-tint",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
