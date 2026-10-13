"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { letterAnchorId, SONGBOOK_LETTERS, type SongbookLetter } from "@/server/domain/songs/title";

export type SongLetterGridProps = {
  /** The letters that have songs; the others are dimmed. */
  available: ReadonlySet<SongbookLetter>;
};

const TILE =
  "grid size-12 place-items-center rounded-lg text-lg font-semibold focus-visible:outline-offset-0";

/** Smooth only when the member has not asked for less motion (SPEC §15.2). */
function scrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: no-preference)").matches ? "smooth" : "auto";
}

/**
 * "A–Å" in the finder bar (SPEC §9.6): a <details>, so it opens and the
 * letters jump (plain #bogstav-… anchors) before hydration too. A 6×5 grid of
 * 48 px tiles in book order, # first and Æ Ø Å last; letters without songs
 * are dimmed. With JavaScript, choosing a letter closes the panel, scrolls
 * to the heading and moves focus there; Escape and a tap outside close it.
 */
export function SongLetterGrid({ available }: SongLetterGridProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const details = detailsRef.current;
    function onPointerDown(event: PointerEvent) {
      if (details && event.target instanceof Node && !details.contains(event.target)) {
        details.open = false;
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || !details) return;
      details.open = false;
      details.querySelector("summary")?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function jump(event: React.MouseEvent<HTMLAnchorElement>, letter: SongbookLetter) {
    const heading = document.getElementById(letterAnchorId(letter));
    if (!heading) return;
    event.preventDefault();
    if (detailsRef.current) detailsRef.current.open = false;
    heading.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    heading.focus({ preventScroll: true });
  }

  return (
    <details
      ref={detailsRef}
      className="group relative shrink-0"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary
        aria-label="Hop til bogstav"
        className="grid h-12 w-11 cursor-pointer list-none place-items-center rounded-lg border border-input bg-paper text-[0.95rem] font-bold text-olive select-none group-open:border-olive group-open:bg-olive group-open:text-cream hover:bg-cream-deep group-open:hover:bg-olive-soft [&::-webkit-details-marker]:hidden"
      >
        A–Å
      </summary>
      <div className="absolute top-full right-0 z-30 mt-2 w-max rounded-xl border border-border bg-paper p-2 shadow-lg">
        <ul className="grid grid-cols-[repeat(6,3rem)] gap-1">
          {SONGBOOK_LETTERS.map((letter) => (
            <li key={letter}>
              {available.has(letter) ? (
                <a
                  href={`#${letterAnchorId(letter)}`}
                  onClick={(event) => jump(event, letter)}
                  aria-label={letter === "#" ? "Tal og tegn" : undefined}
                  className={cn(
                    TILE,
                    "bg-olive-tint text-olive-deep hover:bg-olive hover:text-cream",
                  )}
                >
                  {letter}
                </a>
              ) : (
                <span
                  role="link"
                  aria-disabled="true"
                  aria-label={letter === "#" ? "Tal og tegn" : undefined}
                  className={cn(TILE, "text-slate/45")}
                >
                  {letter}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
