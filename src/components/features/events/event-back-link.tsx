"use client";

import { useBackHref } from "@/components/features/app-shell/use-back-href";
import { BackLink } from "@/components/features/back-link";
import { calendarHref } from "@/components/features/calendar/calendar-params";
import { eventHref, overviewHref } from "@/lib/routes";

/**
 * "← Tilbage" above the event (D-179): to the club page the member came from
 * (Overblik, Kalender, a place, a beer …), skipping forms. Opened directly,
 * after a reload or without JS: the calendar. Desktop only; on mobile it sits
 * in the top bar (D-182).
 */
export function EventBackLink({ clubId, eventId }: { clubId: string; eventId: string }) {
  const href = useBackHref(eventHref(clubId, eventId), overviewHref(clubId), calendarHref(clubId));
  return (
    <BackLink href={href} className="max-md:hidden">
      Tilbage
    </BackLink>
  );
}
