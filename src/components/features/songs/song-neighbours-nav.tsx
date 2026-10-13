"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type SongNeighbour = { title: string; href: string };

export type SongNeighboursNavProps = {
  previous: SongNeighbour | null;
  next: SongNeighbour | null;
};

/** Typing, a modifier or an open dialog: the arrow keys are not ours. */
function isArrowKeyFree(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return false;
  }
  const target = event.target;
  if (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest("input, textarea, select, [role='slider']"))
  ) {
    return false;
  }
  return document.querySelector("[role='dialog'], [role='alertdialog']") === null;
}

/**
 * Forrige / Næste sang (SPEC §9.6): through the WHOLE book in Danish order
 * (not the active search), without wrapping, so the first song has only
 * "Næste" and the last only "Forrige". On desktop ← and → do the same.
 *
 * prefetch={true}: D-052 forbids it only on links into ANOTHER club; these
 * stay in the club (rememberActiveClub is a no-op), so the next song opens at
 * once at the table.
 */
export function SongNeighboursNav({ previous, next }: SongNeighboursNavProps) {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (!isArrowKeyFree(event)) return;
      const target = event.key === "ArrowLeft" ? previous : next;
      if (!target) return;
      event.preventDefault();
      router.push(target.href);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [previous, next, router]);

  if (!previous && !next) return null;

  return (
    <nav aria-label="Forrige og næste sang" className="grid grid-cols-2 gap-3">
      {previous ? (
        <NeighbourCard neighbour={previous} direction="previous" />
      ) : (
        <span aria-hidden />
      )}
      {next ? <NeighbourCard neighbour={next} direction="next" /> : null}
    </nav>
  );
}

function NeighbourCard({
  neighbour,
  direction,
}: {
  neighbour: SongNeighbour;
  direction: "previous" | "next";
}) {
  const isNext = direction === "next";
  return (
    <Link
      href={neighbour.href}
      prefetch={true}
      rel={isNext ? "next" : "prev"}
      className={cn(
        "group flex min-h-16 min-w-0 items-center gap-2 rounded-xl border border-border bg-paper px-3 py-3 text-ink transition-colors hover:border-olive/40 hover:bg-olive-tint/50 sm:px-4",
        isNext && "flex-row-reverse text-right",
      )}
    >
      {isNext ? (
        <ChevronRightIcon aria-hidden className="size-5 shrink-0 text-olive" />
      ) : (
        <ChevronLeftIcon aria-hidden className="size-5 shrink-0 text-olive" />
      )}
      <span className="grid min-w-0 flex-1 grid-cols-1">
        <span className="text-[0.9rem] text-muted-foreground">
          {isNext ? "Næste sang" : "Forrige sang"}
        </span>
        <span className="line-clamp-2 font-semibold break-words hyphens-auto">
          {neighbour.title}
        </span>
      </span>
    </Link>
  );
}
