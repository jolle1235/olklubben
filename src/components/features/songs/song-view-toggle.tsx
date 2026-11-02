"use client";

import { SegmentedControl } from "@/components/ui/segmented-control";
import { useHydrated } from "@/hooks/use-hydrated";
import type { SongView } from "@/lib/songbook-prefs";

import { setSongView, useSongView } from "./use-songbook-prefs";

const VIEWS = [
  { value: "lyrics", label: "Tekst" },
  { value: "chords", label: "Akkorder" },
] as const satisfies readonly { value: SongView; label: string }[];

/**
 * Tekst | Akkorder (SPEC §9.6). Remembered per device. Both views are already
 * on the page (SongTextView); this only flips <html data-song-view>. Disabled
 * until hydrated (TG-020). Rendered only for songs with chords.
 */
export function SongViewToggle({ className }: { className?: string }) {
  const view = useSongView();
  const hydrated = useHydrated();

  return (
    <SegmentedControl
      label="Visning"
      options={VIEWS}
      value={hydrated ? view : null}
      disabled={!hydrated}
      onChange={setSongView}
      className={className}
    />
  );
}
