import "server-only";

import { cache } from "react";

import type { Prisma } from "@/generated/prisma/client";
import { compareByDisplayName } from "@/lib/format/display-name";
import { isValidId } from "@/lib/ids";
import { imageVersionOf, imageVersionSelect } from "@/server/beers/queries";
import { getRatingStats, NO_RATINGS, type RatingStats } from "@/server/beers/rating-stats";
import { db } from "@/server/db";
import { topRatedBeer } from "@/server/domain/events/history";
import { fallbackStartCutoff } from "@/server/domain/events/status";
import { suggestEventTitle } from "@/server/domain/events/title";
import { ACTIVE_POLL_STATUSES } from "@/server/domain/polls/options";
import { personSelect, type PersonRef } from "@/server/users/select";

/**
 * Read queries for events (SPEC §9.1–9.3, round 3: places, hosts, history).
 *
 * Club isolation (§4.4): every query takes the clubId and filters by it, so an
 * event of another club is simply "not found". The caller must already have
 * checked membership (requireMembership / requireEvent).
 *
 * "Upcoming or ongoing" (§9.1): endsAt > now, or – without endsAt –
 * startsAt > now − 6 h (src/server/domain/events/status.ts). "Past" is the
 * exact complement (listPastEvents, D-107).
 */

/** Where an event is (D-099). An archived place still shows on its events (E4). */
export type EventPlace = {
  id: string;
  name: string;
  /** "Åbn i kort" searches it (D-101); null → "Tilføj adresse". */
  address: string | null;
  archived: boolean;
};

export type EventSummary = {
  id: string;
  title: string;
  theme: string | null;
  startsAt: Date;
  endsAt: Date | null;
  place: EventPlace;
};

/** A host; isMember is false for a host who has left the club (history, §7.4). */
export type EventHostRef = PersonRef & { isMember: boolean };

export type EventDetail = EventSummary & {
  /** Line breaks are "\n". */
  description: string | null;
  createdById: string;
  createdBy: PersonRef;
  /** For canEditEvent (creator, host or admin, D-098). */
  hostIds: string[];
  /** Sorted by display name. */
  hosts: EventHostRef[];
  /** The poll that created the event ("Valgt ved afstemning 🗳", §9.7.7), else null. */
  pollId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PastEventSummary = EventSummary & {
  beerCount: number;
  /** The best-rated beer of the evening (topRatedBeer), null when nothing is rated. */
  topBeer: { id: string; name: string; averageStars: number } | null;
};

export type EventOption = { id: string; title: string; startsAt: Date };

export type EventBeer = RatingStats & {
  id: string;
  name: string;
  abv: number;
  createdAt: Date;
  /** The photo's version for beerImageHref, null without a photo (D-158). */
  imageVersion: number | null;
};

const placeSelect = {
  select: { id: true, name: true, address: true, archivedAt: true },
} as const;

const summarySelect = {
  id: true,
  title: true,
  theme: true,
  startsAt: true,
  endsAt: true,
  place: placeSelect,
} satisfies Prisma.EventSelect;

type SummaryRow = Prisma.EventGetPayload<{ select: typeof summarySelect }>;

function toSummary(row: SummaryRow): EventSummary {
  const { place, ...event } = row;
  return {
    id: event.id,
    title: event.title,
    theme: event.theme,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    place: {
      id: place.id,
      name: place.name,
      address: place.address,
      archived: place.archivedAt !== null,
    },
  };
}

/** Oldest first; id breaks ties so the order never flickers. */
const chronological = [
  { startsAt: "asc" },
  { id: "asc" },
] satisfies Prisma.EventOrderByWithRelationInput[];

/** Newest first (history, a place's events). */
const newestFirst = [
  { startsAt: "desc" },
  { id: "desc" },
] satisfies Prisma.EventOrderByWithRelationInput[];

function upcomingOrOngoingWhere(clubId: string, now: Date): Prisma.EventWhereInput {
  return {
    clubId,
    OR: [{ endsAt: { gt: now } }, { endsAt: null, startsAt: { gt: fallbackStartCutoff(now) } }],
  };
}

/** The exact complement of upcomingOrOngoingWhere: the event is over. */
function endedWhere(clubId: string, now: Date): Prisma.EventWhereInput {
  return {
    clubId,
    OR: [{ endsAt: { lte: now } }, { endsAt: null, startsAt: { lte: fallbackStartCutoff(now) } }],
  };
}

/**
 * One event of the club with its place, creator and hosts, or null (unknown
 * id, malformed id or another club's event). Cached per request, so a guard
 * layout and its page share one query.
 */
export const getEvent = cache(
  async (clubId: string, eventId: string): Promise<EventDetail | null> => {
    if (!isValidId(eventId)) return null;
    const row = await db.event.findFirst({
      where: { id: eventId, clubId },
      select: {
        ...summarySelect,
        description: true,
        createdById: true,
        pollId: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: personSelect },
        hosts: {
          select: {
            user: {
              select: {
                ...personSelect,
                memberships: { where: { clubId }, select: { id: true } },
              },
            },
          },
        },
      },
    });
    if (!row) return null;

    const hosts = row.hosts
      .map(({ user: { memberships, ...person } }) => ({
        ...person,
        isMember: memberships.length > 0,
      }))
      .sort(compareByDisplayName);
    return {
      ...toSummary(row),
      description: row.description,
      createdById: row.createdById,
      createdBy: row.createdBy,
      hostIds: hosts.map((host) => host.id),
      hosts,
      pollId: row.pollId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  },
);

/** The hero event (§9.1): the earliest event that is upcoming or still ongoing, or null. */
export async function getNextEvent(clubId: string, now: Date): Promise<EventSummary | null> {
  const row = await db.event.findFirst({
    where: upcomingOrOngoingWhere(clubId, now),
    select: summarySelect,
    orderBy: chronological,
  });
  return row ? toSummary(row) : null;
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
  const rows = await db.event.findMany({
    where: options.excludeId ? { AND: [where, { id: { not: options.excludeId } }] } : where,
    select: summarySelect,
    orderBy: chronological,
    take: options.limit,
  });
  return rows.map(toSummary);
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
  const rows = await db.event.findMany({
    where: { clubId, startsAt: { gte: fromUtc, lt: toUtc } },
    select: summarySelect,
    orderBy: chronological,
  });
  return rows.map(toSummary);
}

/**
 * "Tidligere ølsmagninger" (D-107): events that are over, newest first, with
 * the number of beers and the best-rated one. `limit` caps the list (Overblik
 * 3, the calendar 12; without it: all).
 */
export async function listPastEvents(
  clubId: string,
  now: Date,
  options: { limit?: number } = {},
): Promise<PastEventSummary[]> {
  const rows = await db.event.findMany({
    where: endedWhere(clubId, now),
    select: {
      ...summarySelect,
      beers: { select: { id: true, name: true } },
    },
    orderBy: newestFirst,
    take: options.limit,
  });
  if (rows.length === 0) return [];

  const stats = await getRatingStats(
    { beer: { clubId, eventId: { in: rows.map((row) => row.id) } } },
    null,
  );
  return rows.map(({ beers, ...row }) => {
    const top = topRatedBeer(
      beers.map((beer) => ({ ...beer, ...(stats.get(beer.id) ?? NO_RATINGS) })),
    );
    return {
      ...toSummary(row),
      beerCount: beers.length,
      topBeer:
        top && top.averageStars !== null
          ? { id: top.id, name: top.name, averageStars: top.averageStars }
          : null,
    };
  });
}

/** How many events are over ("Vis alle N tidligere"). */
export async function countPastEvents(clubId: string, now: Date): Promise<number> {
  return db.event.count({ where: endedWhere(clubId, now) });
}

/** The events at one place of the club, newest first ("Ølsmagninger her", §9.4). */
export async function listEventsAtPlace(clubId: string, placeId: string): Promise<EventSummary[]> {
  if (!isValidId(placeId)) return [];
  const rows = await db.event.findMany({
    where: { clubId, placeId },
    select: summarySelect,
    orderBy: newestFirst,
  });
  return rows.map(toSummary);
}

/** Every event of the club for the beer form's "Event" select, newest first. */
export async function listEventOptions(clubId: string): Promise<EventOption[]> {
  return db.event.findMany({
    where: { clubId },
    select: { id: true, title: true, startsAt: true },
    orderBy: newestFirst,
  });
}

/**
 * The new-event form's title suggestion (D-064): "Ølsmagning #N" after the
 * club's event count and its highest "Ølsmagning #N" title. Polls that are
 * not finished (OPEN, AWAITING_DECISION) count too, because each becomes an
 * event: two plans in parallel never both say "#15" (D-137). Also the poll
 * form's suggestion (getSuggestedPollTitle).
 */
export async function getSuggestedEventTitle(clubId: string): Promise<string> {
  const [events, polls] = await Promise.all([
    db.event.findMany({ where: { clubId }, select: { title: true } }),
    db.poll.findMany({
      where: { clubId, status: { in: [...ACTIVE_POLL_STATUSES] } },
      select: { title: true },
    }),
  ]);
  const titles = [...events, ...polls].map((row) => row.title);
  return suggestEventTitle(titles.length, titles);
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
    select: {
      id: true,
      name: true,
      abv: true,
      createdAt: true,
      image: imageVersionSelect,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  if (beers.length === 0) return [];

  const stats = await getRatingStats({ beer: { clubId, eventId } }, userId);
  return beers.map((beer) => ({
    id: beer.id,
    name: beer.name,
    abv: beer.abv.toNumber(),
    createdAt: beer.createdAt,
    imageVersion: imageVersionOf(beer.image),
    ...(stats.get(beer.id) ?? NO_RATINGS),
  }));
}
