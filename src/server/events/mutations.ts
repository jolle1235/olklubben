import "server-only";

import type { EventPlaceChoice } from "@/lib/validation/event";
import { db, type TransactionClient } from "@/server/db";
import { lockEvent, lockMemberIds, lockPlace } from "@/server/db/locks";
import { resolveHostIds } from "@/server/domain/events/hosts";
import { findOrCreatePlaceTx } from "@/server/places/mutations";

export type { EventPlaceChoice };

/**
 * Writes for events (SPEC §9.2, D-098, D-099).
 *
 * Authorization is the caller's job (the Server Actions): membership with
 * requireMembership(clubId), and canEditEvent/canDeleteEvent (creator, host or
 * admin) for changes. These functions trust their arguments but always scope
 * by clubId (§4.4), so an event or place of another club is never touched.
 *
 * Invariants decided here under locks (src/server/db/locks.ts), never by
 * catching a database error inside the transaction:
 *   * the place is in the club (composite FK) and active – an archived place
 *     is only allowed when it already is the event's place (E30);
 *   * a new place reuses an ACTIVE place with the same name (D-099);
 *   * new hosts are members at write time (their memberships FOR SHARE);
 *     existing hosts who left may stay (history, §7.4). Empty hostIds = the
 *     default: the place's owners, else the creator (on edit: else the editor).
 */

/** What the event form stores (= EventFormData from src/lib/validation/event.ts). */
export type EventWriteData = {
  title: string;
  theme: string | null;
  description: string | null;
  startsAt: Date;
  endsAt: Date | null;
  place: EventPlaceChoice;
  hostIds: readonly string[];
};

/** The chosen place is not in the club (or gone), or archived. → fieldErrors.placeId */
export class PlaceNotSelectableError extends Error {
  readonly code = "PLACE_NOT_SELECTABLE";

  constructor(readonly reason: "NOT_FOUND" | "ARCHIVED") {
    super(reason === "ARCHIVED" ? "Stedet er arkiveret." : "Stedet findes ikke.");
    this.name = "PlaceNotSelectableError";
  }
}

/** A chosen host is not a member of the club (and not already a host). → fieldErrors.hostIds */
export class InvalidEventHostsError extends Error {
  readonly code = "INVALID_EVENT_HOSTS";

  constructor(readonly userIds: string[]) {
    super("Værterne skal være medlemmer af klubben.");
    this.name = "InvalidEventHostsError";
  }
}

type Tx = TransactionClient;

/**
 * The event's place inside the transaction: an existing one locked FOR SHARE
 * (it cannot be archived or deleted until the event is written), or a new one
 * found or created by name. `allowArchivedId` is the event's current place on
 * edit (E30).
 */
async function resolvePlaceTx(
  tx: Tx,
  input: {
    clubId: string;
    createdById: string;
    place: EventPlaceChoice;
    allowArchivedId?: string;
  },
): Promise<{ placeId: string; ownerIds: string[] }> {
  const { clubId, place } = input;
  if (place.kind === "new") {
    const created = await findOrCreatePlaceTx(tx, {
      clubId,
      createdById: input.createdById,
      name: place.name,
      address: place.address,
      ownedByCreator: place.ownedByCreator,
    });
    return { placeId: created.placeId, ownerIds: created.ownerIds };
  }

  const locked = await lockPlace(tx, clubId, place.placeId, "SHARE");
  if (!locked) throw new PlaceNotSelectableError("NOT_FOUND");
  if (locked.archivedAt !== null && locked.id !== input.allowArchivedId) {
    throw new PlaceNotSelectableError("ARCHIVED");
  }
  const owners = await tx.placeOwner.findMany({
    where: { placeId: locked.id, clubId },
    select: { userId: true },
    orderBy: { createdAt: "asc" },
  });
  return { placeId: locked.id, ownerIds: owners.map((owner) => owner.userId) };
}

/**
 * Creates an event with its place and hosts in one transaction. Throws
 * PlaceNotSelectableError or InvalidEventHostsError (nothing is written).
 */
export async function createEvent(
  input: { clubId: string; createdById: string } & EventWriteData,
): Promise<{ id: string; placeId: string }> {
  const { clubId, createdById, place, hostIds: requested, ...fields } = input;
  return db.$transaction(async (tx) => {
    const { placeId, ownerIds } = await resolvePlaceTx(tx, { clubId, createdById, place });

    const memberIds = await lockMemberIds(tx, clubId, [...ownerIds, ...requested, createdById]);
    const hosts = resolveHostIds({
      requested,
      ownerIds,
      fallbackUserIds: [createdById],
      memberIds,
      existingHostIds: [],
    });
    if (!hosts.ok) throw new InvalidEventHostsError(hosts.userIds);

    // Unchecked scalar input only: clubId takes part in two relations (D-096).
    const event = await tx.event.create({
      data: {
        clubId,
        placeId,
        createdById,
        ...fields,
        hosts: { createMany: { data: hosts.hostIds.map((userId) => ({ userId })) } },
      },
      select: { id: true },
    });
    return { id: event.id, placeId };
  });
}

/**
 * Updates the event if it is in the club; returns false when it is not
 * (→ 404). Hosts are replaced by the resolved list. Throws
 * PlaceNotSelectableError or InvalidEventHostsError (nothing is written).
 *
 * Lock order: the event row first (it says which place may stay archived),
 * then the place, then the memberships. The existing hosts are read AFTER the
 * memberships are locked: a member removed meanwhile (whose not-started
 * hostships endMembership deletes) is then neither a member nor an existing
 * host, so they cannot be written back.
 */
export async function updateEvent(
  input: { clubId: string; eventId: string; actorUserId: string } & EventWriteData,
): Promise<boolean> {
  const { clubId, eventId, actorUserId, place, hostIds: requested, ...fields } = input;
  return db.$transaction(async (tx) => {
    const row = await lockEvent(tx, clubId, eventId);
    if (!row) return false;

    const { placeId, ownerIds } = await resolvePlaceTx(tx, {
      clubId,
      createdById: actorUserId,
      place,
      allowArchivedId: row.placeId,
    });

    const memberIds = await lockMemberIds(tx, clubId, [
      ...ownerIds,
      ...requested,
      row.createdById,
      actorUserId,
    ]);
    const existing = await tx.eventHost.findMany({
      where: { eventId },
      select: { userId: true },
    });
    const hosts = resolveHostIds({
      requested,
      ownerIds,
      fallbackUserIds: [row.createdById, actorUserId],
      memberIds,
      existingHostIds: existing.map((host) => host.userId),
    });
    if (!hosts.ok) throw new InvalidEventHostsError(hosts.userIds);

    await tx.event.updateMany({ where: { id: eventId, clubId }, data: { ...fields, placeId } });
    await tx.eventHost.deleteMany({ where: { eventId, userId: { notIn: hosts.hostIds } } });
    await tx.eventHost.createMany({
      data: hosts.hostIds.map((userId) => ({ eventId, userId })),
      skipDuplicates: true,
    });
    return true;
  });
}

/**
 * Deletes the event if it is in the club. Its beers stay in the catalogue with
 * eventId = null, ratings included (E13, ON DELETE SET NULL); its hosts go
 * with it (CASCADE). Returns how many beers lost the link, for the toast.
 */
export async function deleteEvent(input: {
  clubId: string;
  eventId: string;
}): Promise<{ deleted: boolean; detachedBeerCount: number }> {
  const { clubId, eventId } = input;
  return db.$transaction(async (tx) => {
    const detachedBeerCount = await tx.beer.count({ where: { clubId, eventId } });
    const { count } = await tx.event.deleteMany({ where: { id: eventId, clubId } });
    return { deleted: count === 1, detachedBeerCount: count === 1 ? detachedBeerCount : 0 };
  });
}
