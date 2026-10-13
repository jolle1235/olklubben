import type { HighlightRange } from "@/server/domain/songs/search";

/**
 * Text with the search's hits marked (SPEC §9.6): split into plain strings
 * and <mark> elements, never innerHTML. `marks` are sorted, non-overlapping
 * [start, end) ranges (highlightRanges / matchSongs' snippet).
 */
export function Highlighted({ text, marks }: { text: string; marks?: readonly HighlightRange[] }) {
  if (!marks || marks.length === 0) return text;
  const parts: React.ReactNode[] = [];
  let at = 0;
  for (const [start, end] of marks) {
    if (start < at || end <= start) continue;
    if (start > at) parts.push(text.slice(at, start));
    parts.push(
      <mark key={start} className="rounded-sm bg-amber-tint text-ink">
        {text.slice(start, end)}
      </mark>,
    );
    at = end;
  }
  if (at < text.length) parts.push(text.slice(at));
  return parts;
}

/** A lyric line under a search hit: „… line …“ in italic slate, at most two lines. */
export function SongSnippet({ text, marks }: { text: string; marks: readonly HighlightRange[] }) {
  return (
    <span className="mt-1 line-clamp-2 text-[0.95rem] break-words text-slate italic">
      „<Highlighted text={text} marks={marks} />“
    </span>
  );
}
