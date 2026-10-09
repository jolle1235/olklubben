"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import type { MonthKey } from "@/server/domain/calendar/month";
import type { DateKey } from "@/server/domain/events/time";

import { parseSelectedDay } from "./calendar-params";

/** One dot per event (at most three): upcoming in olive, past in slate. */
export type DayDot = "upcoming" | "past";

export type DayLinkProps = {
  /** ?view=month&month=…&day=… for this date. */
  href: string;
  dateKey: DateKey;
  /** The month the grid shows; its days are selected in place. */
  monthKey: MonthKey;
  inMonth: boolean;
  isToday: boolean;
  /** Day of the month, 1–31. */
  day: number;
  /** "fredag 23. oktober, 1 event" (built on the server). */
  label: string;
  dots: DayDot[];
};

/**
 * A date in the mobile month grid (SPEC §9.3): the day number with a dot per
 * event. Tapping it shows the day's events under the grid (the day panel).
 *
 * The selection lives in the URL (?day=), so a refresh keeps it and the link
 * works without JavaScript. With JavaScript, a day of the shown month is
 * selected in place: the URL is replaced (no history entry per tap, no server
 * round trip) and useSearchParams() updates this link and the day panel. A
 * day of the neighbouring month navigates to that month.
 */
export function DayLink({
  href,
  dateKey,
  monthKey,
  inMonth,
  isToday,
  day,
  label,
  dots,
}: DayLinkProps) {
  const searchParams = useSearchParams();
  const selected = inMonth && parseSelectedDay(searchParams.get("day"), monthKey) === dateKey;

  return (
    <Link
      href={href}
      scroll={false}
      prefetch={false}
      aria-label={selected ? `${label}, valgt` : label}
      aria-current={isToday ? "date" : undefined}
      onNavigate={
        inMonth
          ? (event) => {
              event.preventDefault();
              window.history.replaceState(null, "", href);
            }
          : undefined
      }
      className={cn(
        "flex h-12 w-full flex-col items-center justify-center gap-0.5 rounded-xl transition-colors",
        selected ? "bg-olive text-cream" : "hover:bg-cream-deep",
      )}
    >
      <span
        className={cn(
          "grid size-7 place-items-center rounded-full text-base tabular-nums",
          inMonth ? "font-semibold" : "font-normal",
          // Today is marked in harbor blue (the secondary colour); a cream ring
          // keeps the circle visible on the selected day's olive tile.
          isToday
            ? cn("bg-harbor text-paper", selected && "ring-2 ring-cream")
            : selected
              ? "text-cream"
              : inMonth
                ? "text-olive"
                : "text-slate",
        )}
      >
        {day}
      </span>
      <span aria-hidden className="flex h-1.5 gap-0.5">
        {dots.map((dot, index) => (
          <span
            key={index}
            className={cn(
              "size-1.5 rounded-full",
              selected ? "bg-amber" : dot === "past" ? "bg-slate" : "bg-olive",
            )}
          />
        ))}
      </span>
    </Link>
  );
}
