import Link from "next/link";
import { useId } from "react";

import { cn } from "@/lib/utils";
import type { FeedbackListParams } from "@/server/domain/feedback/list-params";

import { feedbackFilterGroups, type FeedbackFilterChip } from "./feedback-labels";

/**
 * The feedback list's filters (SPEC §9.9 "Oversigt"): type, status ("Åbne",
 * "Lukkede", "Alle"), the "Mine rapporter" toggle and the sort. Plain links
 * (feedbackListHref, defaults left out), so they work without JavaScript and a
 * filtered list can be shared. The chosen chip has aria-current="true" and is
 * filled olive; every chip is a 44 px touch target.
 */
export function FeedbackFilters({ params }: { params: FeedbackListParams }) {
  const groups = feedbackFilterGroups(params);
  return (
    <nav aria-label="Filtrér og sortér" className="mb-6 grid grid-cols-1 gap-3 md:mb-8">
      <ChipGroup label="Type" chips={groups.type} />
      <ChipGroup label="Status" chips={groups.status} />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <ChipGroup label="Vis" chips={[groups.mine]} toggle />
        <ChipGroup label="Sortér" chips={groups.sort} />
      </div>
    </nav>
  );
}

function ChipGroup({
  label,
  chips,
  toggle = false,
}: {
  label: string;
  chips: readonly FeedbackFilterChip[];
  /** A single on/off chip: shows a ✓ while on. */
  toggle?: boolean;
}) {
  const labelId = useId();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span id={labelId} className="w-14 shrink-0 text-[0.95rem] font-semibold text-slate">
        {label}
      </span>
      <ul aria-labelledby={labelId} className="flex min-w-0 flex-wrap gap-2">
        {chips.map((chip) => (
          <li key={chip.key}>
            <Link
              href={chip.href}
              aria-current={chip.current ? "true" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 font-semibold whitespace-nowrap transition-colors",
                chip.current
                  ? "border-primary bg-primary text-primary-foreground hover:bg-olive-deep"
                  : "border-border bg-paper text-ink hover:border-input hover:bg-cream-deep",
              )}
            >
              {toggle && chip.current ? <span aria-hidden>✓</span> : null}
              {chip.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
