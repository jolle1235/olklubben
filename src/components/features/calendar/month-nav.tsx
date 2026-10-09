import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LinkPending } from "@/components/ui/link-pending";
import {
  monthKeyLabel,
  nextMonthKey,
  parseMonthKey,
  prevMonthKey,
  type MonthKey,
} from "@/server/domain/calendar/month";

import { calendarHref, type CalendarView } from "./calendar-params";

export type CalendarMonthNavProps = {
  clubId: string;
  monthKey: MonthKey;
  /** Kept in the links, so the view does not change while browsing months. */
  view: CalendarView | null;
  /** id for the month heading (labels the month section). */
  headingId: string;
};

/**
 * The month view's header (SPEC §9.3): "Oktober 2026" and ‹ ›. Links
 * (?month=YYYY-MM), so the month survives a refresh and the buttons work
 * without JavaScript; every month can be browsed, also past ones (D-062).
 * [I dag] joins them from md (below md it is in the view toggle's row).
 * The heading is a polite live region, so a screen reader hears the new
 * month after ‹ or ›, while focus stays on the button. One row at 320 px for
 * every month name, so the grid never jumps between months. At the ends of
 * the range (1900-01, 2999-12) the arrow out of it is disabled instead of
 * jumping to the current month.
 */
export function CalendarMonthNav({ clubId, monthKey, view, headingId }: CalendarMonthNavProps) {
  const prev = parseMonthKey(prevMonthKey(monthKey));
  const next = parseMonthKey(nextMonthKey(monthKey));
  return (
    <div className="mb-3 flex items-center justify-between gap-3 md:mb-4">
      <h2
        id={headingId}
        aria-live="polite"
        className="min-w-0 text-xl leading-tight font-bold text-olive capitalize md:text-[1.75rem]"
      >
        {monthKeyLabel(monthKey)}
      </h2>
      <div className="flex shrink-0 items-center gap-2">
        <CalendarTodayLink clubId={clubId} view={view} className="hidden md:inline-flex" />
        <MonthStepLink
          href={prev ? calendarHref(clubId, { view, month: prev }) : null}
          label="Forrige måned"
          icon={<ChevronLeftIcon aria-hidden />}
        />
        <MonthStepLink
          href={next ? calendarHref(clubId, { view, month: next }) : null}
          label="Næste måned"
          icon={<ChevronRightIcon aria-hidden />}
        />
      </div>
    </div>
  );
}

/** ‹ or ›; a disabled button where the range ends (href null). */
function MonthStepLink({
  href,
  label,
  icon,
}: {
  href: string | null;
  label: string;
  icon: React.ReactNode;
}) {
  if (!href) {
    return (
      <Button variant="outline" size="icon" disabled aria-label={label}>
        {icon}
      </Button>
    );
  }
  return (
    <Button asChild variant="outline" size="icon">
      <Link href={href} aria-label={label} scroll={false}>
        <LinkPending>{icon}</LinkPending>
      </Link>
    </Button>
  );
}

/**
 * [I dag]: back to the current month (and no selected day). Next to ‹ › from
 * md; below md it sits in the view toggle's row (className="md:hidden"), so
 * the month header fits one row on a phone.
 */
export function CalendarTodayLink({
  clubId,
  view,
  className,
}: {
  clubId: string;
  view: CalendarView | null;
  className?: string;
}) {
  return (
    <Button asChild variant="outline" className={className}>
      <Link href={calendarHref(clubId, { view })} scroll={false}>
        <LinkPending>I dag</LinkPending>
      </Link>
    </Button>
  );
}
