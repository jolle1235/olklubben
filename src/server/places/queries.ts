import "server-only";

import { cache } from "react";

import type { Prisma } from "@/generated/prisma/client";
import { compareByDisplayName, getDisplayName } from "@/lib/format/display-name";
import { isValidId } from "@/lib/ids";
import { db } from "@/server/db";
import { comparePlacesByName } from "@/server/domain/places/name";
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
};

export type PlaceDetail = PlaceListItem & {
  /** Line breaks are "\n". */
  description: string | null;
  createdById: string;
  createdBy: PersonRef;
  /** For the permission checks (PlaceAccess). */
  ownerIds: string[];
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
  _count: { select: { events: true } },
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
    const item = toListItem(row);
    return {
      ...item,
      description: row.description,
      createdById: row.createdById,
      createdBy: row.createdBy,
      ownerIds: item.owners.map((owner) => owner.id),
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

/** How much the place is used (removal decides archive vs. delete, §9.4). */
export async function getPlaceUsage(clubId: string, placeId: string): Promise<PlaceUsage> {
  if (!isValidId(placeId)) return { eventCount: 0 };
  const eventCount = await db.event.count({ where: { clubId, placeId } });
  return { eventCount };
}
