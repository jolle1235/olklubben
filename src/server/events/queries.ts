import "server-only";

import { cache } from "react";

import type { Prisma } from "@/generated/prisma/client";
import { isValidId } from "@/lib/ids";
import { getRatingStats, NO_RATINGS, type RatingStats } from "@/server/beers/rating-stats";
import { db } from "@/server/db";
import { fallbackStartCutoff } from "@/server/domain/events/status";
import { suggestEventTitle } from "@/server/domain/events/title";

/**
 * Read queries for events (SPEC §9.1–9.3).
 *
 * Club isolation (§4.4): every query takes the clubId and filters by it, so an
 * event of another club is simply "not found". The caller must already have
 * checked membership (requireMembership / requireEvent).
 *
 * "Upcoming or ongoing" (§9.1): endsAt > now, or – without endsAt –
 * startsAt > now − 6 h (src/server/domain/events/status.ts).
 */

export type EventSummary = {
  id: string;
  title: string;
  theme: string | null;
  /** Free-text place (D-022). */
  locationText: string;
  startsAt: Date;
  endsAt: Date | null;
};

export type EventDetail = EventSummary & {
  /** Line breaks are "\n". */
  description: string | null;
  createdById: string;
  createdBy: { id: string; name: string };
  createdAt: Date;
  updatedAt: Date;
};

export type EventOption = { id: string; title: string; startsAt: Date };

export type EventBeer = RatingStats & {
  id: string;
  name: string;
  abv: number;
  createdAt: Date;
};

const summarySelect = {
  id: true,
  title: true,
  theme: true,
  locationText: true,
  startsAt: true,
  endsAt: true,
} satisfies Prisma.EventSelect;

/** Oldest first; id breaks ties so the order never flickers. */
const chronological = [
  { startsAt: "asc" },
  { id: "asc" },
] satisfies Prisma.EventOrderByWithRelationInput[];

function upcomingOrOngoingWhere(clubId: string, now: Date): Prisma.EventWhereInput {
  return {
    clubId,
    OR: [{ endsAt: { gt: now } }, { endsAt: null, startsAt: { gt: fallbackStartCutoff(now) } }],
  };
}

/**
 * One event of the club with its creator, or null (unknown id, malformed id
 * or another club's event). Cached per request, so a guard layout and its page
 * share one query.
 */
export const getEvent = cache(
  async (clubId: string, eventId: string): Promise<EventDetail | null> => {
    if (!isValidId(eventId)) return null;
    return db.event.findFirst({
      where: { id: eventId, clubId },
      select: {
        ...summarySelect,
        description: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: { id: true, name: true } },
      },
    });
  },
);

/** The hero event (§9.1): the earliest event that is upcoming or still ongoing, or null. */
export async function getNextEvent(clubId: string, now: Date): Promise<EventSummary | null> {
  return db.event.findFirst({
    where: upcomingOrOngoingWhere(clubId, now),
    select: summarySelect,
    orderBy: chronological,
  });
}

/**
 * Upcoming and ongoing events, oldest first ("Kommende arrangementer", the
 * calendar list). `excludeId` leaves out e.g. the hero event; `limit` caps it.
 */
export async function listUpcomingEvents(
  clubId: string,
  now: Date,
  options: { limit?: number; excludeId?: string } = {},
): Promise<EventSummary[]> {
  const where = upcomingOrOngoingWhere(clubId, now);
  return db.event.findMany({
    where: options.excludeId ? { AND: [where, { id: { not: options.excludeId } }] } : where,
    select: summarySelect,
    orderBy: chronological,
    take: options.limit,
  });
}

/**
 * Events that START in [fromUtc, toUtc), oldest first – for the month grid
 * (monthRange / monthGridRange in src/server/domain/calendar/month.ts).
 */
export async function listEventsInRange(
  clubId: string,
  fromUtc: Date,
  toUtc: Date,
): Promise<EventSummary[]> {
  return db.event.findMany({
    where: { clubId, startsAt: { gte: fromUtc, lt: toUtc } },
    select: summarySelect,
    orderBy: chronological,
  });
}

/** Every event of the club for the beer form's "Event" select, newest first. */
export async function listEventOptions(clubId: string): Promise<EventOption[]> {
  return db.event.findMany({
    where: { clubId },
    select: { id: true, title: true, startsAt: true },
    orderBy: [{ startsAt: "desc" }, { id: "desc" }],
  });
}

/**
 * The new-event form's title suggestion (D-064): "Ølsmagning #N" after the
 * club's event count and its highest "Ølsmagning #N" title. One query.
 */
export async function getSuggestedEventTitle(clubId: string): Promise<string> {
  const events = await db.event.findMany({ where: { clubId }, select: { title: true } });
  return suggestEventTitle(
    events.length,
    events.map((event) => event.title),
  );
}

/**
 * The beers tasted at an event ("Øl smagt til dette event", §9.2) in the order
 * they were added, with the club's rating and – given a userId – the user's own.
 * Empty for an event of another club.
 */
export async function getEventBeers(
  clubId: string,
  eventId: string,
  userId: string | null = null,
): Promise<EventBeer[]> {
  if (!isValidId(eventId)) return [];
  const beers = await db.beer.findMany({
    where: { clubId, eventId },
    select: { id: true, name: true, abv: true, createdAt: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  if (beers.length === 0) return [];

  const stats = await getRatingStats({ beer: { clubId, eventId } }, userId);
  return beers.map((beer) => ({
    id: beer.id,
    name: beer.name,
    abv: beer.abv.toNumber(),
    createdAt: beer.createdAt,
    ...(stats.get(beer.id) ?? NO_RATINGS),
  }));
}
