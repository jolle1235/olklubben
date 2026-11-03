"use client";

import { SegmentedControl } from "@/components/ui/segmented-control";
import type { SongView } from "@/lib/songbook-prefs";

import { setSongView, useSongView } from "./use-songbook-prefs";

const VIEWS = [
  { value: "lyrics", label: "Tekst" },
  { value: "chords", label: "Akkorder" },
] as const satisfies readonly { value: SongView; label: string }[];

/**
 * Tekst | Akkorder (SPEC §9.6). Remembered per device. Both views are already
 * on the page (SongTextView); this only flips <html data-song-view>. Disabled
 * until hydrated (useSongView is null until then, TG-020). Rendered only for songs with chords.
 */
export function SongViewToggle({ className }: { className?: string }) {
  const view = useSongView();

  return (
    <SegmentedControl
      label="Visning"
      options={VIEWS}
      value={view}
      disabled={view === null}
      onChange={setSongView}
      className={className}
    />
  );
}
