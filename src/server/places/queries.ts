import "server-only";

import { cache } from "react";

import type { Prisma } from "@/generated/prisma/client";
import { compareByDisplayName, getDisplayName } from "@/lib/format/display-name";
import { isValidId } from "@/lib/ids";
import { db } from "@/server/db";
import { comparePlacesByName } from "@/server/domain/places/name";
import { ACTIVE_POLL_STATUSES } from "@/server/domain/polls/options";
import type { PlaceUsage } from "@/server/domain/places/permissions";
import { personSelect, type PersonRef } from "@/server/users/select";

/**
 * Read queries for places (SPEC §9.4, D-095, D-099, D-100).
 *
 * Club isolation (§4.4): every query takes the clubId and filters by it, so a
 * place of another club is simply "not found". The caller must already have
 * checked membership (requireMembership / requirePlace).
 */

export type PlaceListItem = {
  id: string;
  name: string;
  address: string | null;
  archivedAt: Date | null;
  /** Sorted by display name. */
  owners: PersonRef[];
  /** How many events use the place (decides archive vs. delete, §9.4). */
  eventCount: number;
  /** How many poll options (any poll status) name the place (D-132: used → archive). */
  pollOptionCount: number;
};

export type PlaceDetail = PlaceListItem & {
  /** Line breaks are "\n". */
  description: string | null;
  createdById: string;
  createdBy: PersonRef;
  /** For the permission checks (PlaceAccess). */
  ownerIds: string[];
  /** Polls that are not finished (OPEN, AWAITING_DECISION) with the place as an option (E5). */
  activePolls: { id: string; title: string }[];
  createdAt: Date;
  updatedAt: Date;
};

/** A place in the event form's PlaceSelector. */
export type PlaceOption = {
  id: string;
  name: string;
  address: string | null;
  archived: boolean;
  ownerIds: string[];
  /** Display names, in the same order as ownerIds. */
  ownerNames: string[];
  /** The latest startsAt of the place's events, null when unused ("last used first"). */
  lastUsedAt: Date | null;
};

const listSelect = {
  id: true,
  name: true,
  address: true,
  archivedAt: true,
  owners: { select: { user: { select: personSelect } } },
  _count: { select: { events: true, pollOptions: true } },
} satisfies Prisma.PlaceSelect;

type ListRow = Prisma.PlaceGetPayload<{ select: typeof listSelect }>;

function toListItem(row: ListRow): PlaceListItem {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    archivedAt: row.archivedAt,
    owners: row.owners.map((owner) => owner.user).sort(compareByDisplayName),
    eventCount: row._count.events,
    pollOptionCount: row._count.pollOptions,
  };
}

/** Polls that are not finished with the place as an option (E5), oldest deadline first. */
function activePollsWhere(clubId: string, placeId: string): Prisma.PollWhereInput {
  return {
    clubId,
    status: { in: [...ACTIVE_POLL_STATUSES] },
    options: { some: { placeId } },
  };
}

/**
 * One place of the club with its owners and creator, or null (unknown id,
 * malformed id or another club's place). Cached per request, so the guard
 * layout and its page share one query.
 */
export const getPlace = cache(
  async (clubId: string, placeId: string): Promise<PlaceDetail | null> => {
    if (!isValidId(placeId)) return null;
    const row = await db.place.findFirst({
      where: { id: placeId, clubId },
      select: {
        ...listSelect,
        description: true,
        createdById: true,
        createdBy: { select: personSelect },
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!row) return null;
    const activePolls = await db.poll.findMany({
      where: activePollsWhere(clubId, placeId),
      select: { id: true, title: true },
      orderBy: [{ deadline: "asc" }, { id: "asc" }],
    });
    const item = toListItem(row);
    return {
      ...item,
      description: row.description,
      createdById: row.createdById,
      createdBy: row.createdBy,
      ownerIds: item.owners.map((owner) => owner.id),
      activePolls,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  },
);

/** The club's places by name (Danish order), active and archived apart (§9.4). */
export async function listPlaces(
  clubId: string,
): Promise<{ active: PlaceListItem[]; archived: PlaceListItem[] }> {
  const rows = await db.place.findMany({ where: { clubId }, select: listSelect });
  const places = rows.map(toListItem).sort(comparePlacesByName);
  return {
    active: places.filter((place) => place.archivedAt === null),
    archived: places.filter((place) => place.archivedAt !== null),
  };
}

/**
 * The places the event form offers (D-099): every active place, plus
 * `includePlaceId` even when archived (the event's current place on edit,
 * E30). Last used first (the latest event at the place), unused ones after,
 * then by name.
 */
export async function listPlaceOptions(
  clubId: string,
  options: { includePlaceId?: string | null } = {},
): Promise<PlaceOption[]> {
  const include =
    options.includePlaceId && isValidId(options.includePlaceId) ? options.includePlaceId : null;
  const [rows, usage] = await Promise.all([
    db.place.findMany({
      where: { clubId, OR: [{ archivedAt: null }, ...(include ? [{ id: include }] : [])] },
      select: {
        id: true,
        name: true,
        address: true,
        archivedAt: true,
        owners: { select: { user: { select: personSelect } } },
      },
    }),
    db.event.groupBy({ by: ["placeId"], where: { clubId }, _max: { startsAt: true } }),
  ]);
  const lastUsed = new Map(usage.map((group) => [group.placeId, group._max.startsAt]));

  return rows
    .map((row) => {
      const owners = row.owners.map((owner) => owner.user).sort(compareByDisplayName);
      return {
        id: row.id,
        name: row.name,
        address: row.address,
        archived: row.archivedAt !== null,
        ownerIds: owners.map((owner) => owner.id),
        ownerNames: owners.map((owner) => getDisplayName(owner)),
        lastUsedAt: lastUsed.get(row.id) ?? null,
      };
    })
    .sort((a, b) => compareLastUsed(a.lastUsedAt, b.lastUsedAt) || comparePlacesByName(a, b));
}

/** Most recent first; never used (null) last. */
function compareLastUsed(a: Date | null, b: Date | null): number {
  if (a && b) return b.getTime() - a.getTime();
  if (a) return -1;
  if (b) return 1;
  return 0;
}

/** The usage of a place detail (no query): what canRemovePlace and the labels need. */
export function placeUsageOf(
  place: Pick<PlaceDetail, "eventCount" | "pollOptionCount" | "activePolls">,
): PlaceUsage {
  return {
    eventCount: place.eventCount,
    pollOptionCount: place.pollOptionCount,
    activePollCount: place.activePolls.length,
  };
}

/**
 * How much the place is used (removal decides archive vs. delete, §9.4, and
 * E5 blocks it while a poll is not finished, D-132).
 */
export async function getPlaceUsage(clubId: string, placeId: string): Promise<PlaceUsage> {
  if (!isValidId(placeId)) return { eventCount: 0, pollOptionCount: 0, activePollCount: 0 };
  const [eventCount, pollOptionCount, activePollCount] = await Promise.all([
    db.event.count({ where: { clubId, placeId } }),
    db.pollOption.count({ where: { clubId, placeId } }),
    db.poll.count({ where: activePollsWhere(clubId, placeId) }),
  ]);
  return { eventCount, pollOptionCount, activePollCount };
}
