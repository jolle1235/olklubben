"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import type { MonthKey } from "@/server/domain/calendar/month";
import type { DateKey } from "@/server/domain/events/time";

import { parseSelectedDay } from "./calendar-params";

/**
 * One dot per item (at most three): upcoming events in primary, past ones in
 * muted-foreground, a poll's possible date as a hollow info ring (D-137).
 */
export type DayDot = "upcoming" | "past" | "poll";

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
  /** "fredag 23. oktober, 1 event, 1 mulig dato" (built on the server). */
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
        selected ? "bg-primary text-primary-foreground" : "hover:bg-muted",
      )}
    >
      <span
        className={cn(
          "grid size-7 place-items-center rounded-full text-base tabular-nums",
          inMonth ? "font-semibold" : "font-normal",
          // Today is marked in the info role; a ring in the page colour keeps
          // the circle visible on the selected day's primary tile.
          isToday
            ? cn("bg-info text-info-foreground", selected && "ring-2 ring-background")
            : selected
              ? "text-primary-foreground"
              : inMonth
                ? "text-primary-ink"
                : "text-muted-foreground",
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
              dot === "poll"
                ? cn("border", selected ? "border-primary-foreground" : "border-info")
                : selected
                  ? "bg-primary-foreground"
                  : dot === "past"
                    ? "bg-muted-foreground"
                    : "bg-primary",
            )}
          />
        ))}
      </span>
    </Link>
  );
}
