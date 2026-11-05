import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";

import { formatDayMonthParts, formatLongDate, formatWeekdayShort } from "@/lib/format/date";
import { cn } from "@/lib/utils";

/**
 * The card's look per kind (SPEC §9.3): a confirmed event is filled with a
 * primary accent, a past one is muted, a poll's possible date is dashed in
 * info colours on a transparent background.
 */
const VARIANTS = {
  event: {
    frame:
      "border border-l-4 border-border border-l-primary bg-card shadow-raised hover:bg-card-hover",
    day: "text-primary-ink",
    title: "text-primary-ink",
    badge: "bg-highlight-subtle text-highlight-ink",
  },
  past: {
    frame: "border border-l-4 border-border border-l-border-strong bg-muted-faint hover:bg-muted",
    day: "text-muted-foreground",
    title: "text-primary-ink",
    badge: "bg-highlight-subtle text-highlight-ink",
  },
  poll: {
    frame: "border-2 border-dashed border-info-border bg-transparent hover:bg-info-faint",
    day: "text-info-ink",
    title: "text-info-ink",
    badge: "bg-primary-subtle text-primary-ink",
  },
} as const;

export type DateCardProps = {
  href: string;
  variant: keyof typeof VARIANTS;
  date: Date;
  /** The request's time, for the screen reader's long date. */
  now: Date;
  title: string;
  /** A short pill after the title, e.g. "I aften! 🍻" or "Du kan ✓". */
  badge?: string | null;
  className?: string;
  /** The lines under the title. */
  children: React.ReactNode;
};

/**
 * The shared shape of EventCard and PollOptionCard (SPEC §9.3 list view,
 * §13.4): the day number and short weekday on the left, title, badge and
 * lines on the right, and ›. The whole card is the link.
 */
export function DateCard({
  href,
  variant,
  date,
  now,
  title,
  badge,
  className,
  children,
}: DateCardProps) {
  const look = VARIANTS[variant];

  return (
    <Link
      href={href}
      className={cn(
        "group flex min-h-20 pressable items-center gap-4 rounded-xl px-4 py-3",
        look.frame,
        className,
      )}
    >
      <span aria-hidden className="flex w-11 shrink-0 flex-col items-center text-center">
        <span className={cn("font-display text-headline-md leading-none font-bold", look.day)}>
          {formatDayMonthParts(date)?.day}
        </span>
        <span className="mt-1.5 text-label-sm font-bold caps text-muted-foreground">
          {formatWeekdayShort(date)}
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span
            className={cn(
              "min-w-0 font-heading text-title-sm font-semibold break-words hyphens-auto",
              look.title,
            )}
          >
            {title}
          </span>
          {badge ? (
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-label-md font-bold whitespace-nowrap",
                look.badge,
              )}
            >
              {badge}
            </span>
          ) : null}
        </span>
        <span className="sr-only">, {formatLongDate(date, now)}, </span>
        {children}
      </span>

      <ChevronRightIcon
        aria-hidden
        className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}
