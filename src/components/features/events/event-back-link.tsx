"use client";

import { useSyncExternalStore } from "react";

import { BackLink } from "@/components/features/back-link";
import { calendarHref } from "@/components/features/calendar/calendar-params";
import { backTarget, readNavHistory } from "@/lib/nav-history";
import { eventHref, overviewHref } from "@/lib/routes";

const noopSubscribe = () => () => {};

/**
 * "← Tilbage" above the event (D-179): to the club page the member came from
 * (Overblik, Kalender, a place, a beer …), skipping forms. Opened directly,
 * after a reload or without JS: the calendar.
 */
export function EventBackLink({ clubId, eventId }: { clubId: string; eventId: string }) {
  const fallback = calendarHref(clubId);
  const href = useSyncExternalStore(
    noopSubscribe,
    () => backTarget(readNavHistory(), eventHref(clubId, eventId), overviewHref(clubId), fallback),
    () => fallback,
  );

  return <BackLink href={href}>Tilbage</BackLink>;
}
