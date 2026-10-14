import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db, type TransactionClient } from "@/server/db";
import { lockMemberIds, lockPlace, lockPlaceNames } from "@/server/db/locks";
import type { ClubRole } from "@/server/domain/clubs/permissions";
import { placeNameKey } from "@/server/domain/places/name";
import {
  canRemovePlace,
  placeRemoval,
  placeRemovalBlock,
} from "@/server/domain/places/permissions";
import { ACTIVE_POLL_STATUSES } from "@/server/domain/polls/options";

/**
 * Writes for places (SPEC §9.4, D-095, D-100).
 *
 * Authorization is the caller's job (the Server Actions: membership and the
 * can* checks), except removePlace, which decides archive/delete and the
 * permission again under the place's row lock. Every write is scoped by
 * clubId (§4.4).
 *
 * Name uniqueness: at most one ACTIVE place per name key and club. Every write
 * that can change the set of active names takes the club's place-name
 * advisory lock first and checks (lockPlaceNames), so the partial unique index
 * is only a backstop and a P2002 never aborts an interactive transaction.
 *
 * Inputs are already cleaned by the Zod schemas (src/lib/validation/place.ts).
 */

export class PlaceNameTakenError extends Error {
  readonly code = "PLACE_NAME_TAKEN";

  constructor(readonly existing: { id: string; name: string }) {
    super(`Der findes allerede et sted, der hedder «${existing.name}».`);
    this.name = "PlaceNameTakenError";
  }
}

type Tx = TransactionClient;

/** Another ACTIVE place of the club with the same name key (never findUnique: partial index). */
async function findActiveSameName(
  tx: Tx,
  clubId: string,
  name: string,
  excludeId?: string,
): Promise<{ id: string; name: string } | null> {
  return tx.place.findFirst({
    where: {
      clubId,
      nameKey: placeNameKey(name),
      archivedAt: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, name: true },
  });
}

/**
 * Adds the user as owner if they are still a member (locked FOR SHARE, so the
 * composite FK cannot fail inside the transaction). Returns whether they own it.
 */
async function addOwnerIfMember(
  tx: Tx,
  input: { clubId: string; placeId: string; userId: string },
): Promise<boolean> {
  const members = await lockMemberIds(tx, input.clubId, [input.userId]);
  if (!members.has(input.userId)) return false;
  await tx.placeOwner.createMany({
    data: [{ placeId: input.placeId, clubId: input.clubId, userId: input.userId }],
    skipDuplicates: true,
  });
  return true;
}

/**
 * Creates a place. `makeCreatorOwner` ("Det er mit sted") makes the creator
 * an owner. Throws PlaceNameTakenError when an active place has the same name.
 */
export async function createPlace(input: {
  clubId: string;
  createdById: string;
  name: string;
  address: string | null;
  description: string | null;
  makeCreatorOwner: boolean;
}): Promise<{ id: string }> {
  const { clubId, createdById, name, address, description, makeCreatorOwner } = input;
  return db.$transaction(async (tx) => {
    await lockPlaceNames(tx, clubId);
    const existing = await findActiveSameName(tx, clubId, name);
    if (existing) throw new PlaceNameTakenError(existing);

    const place = await tx.place.create({
      data: { clubId, createdById, name, nameKey: placeNameKey(name), address, description },
      select: { id: true },
    });
    if (makeCreatorOwner) {
      await addOwnerIfMember(tx, { clubId, placeId: place.id, userId: createdById });
    }
    return place;
  });
}

/**
 * Changes name, address and description (every member, archived places too,
 * §9.4). Returns false when the place is not in the club. Throws
 * PlaceNameTakenError when an ACTIVE place is renamed to the name of another
 * active place (an archived one may share a name; restoring it then clashes).
 */
export async function updatePlace(input: {
  clubId: string;
  placeId: string;
  name: string;
  address: string | null;
  description: string | null;
}): Promise<boolean> {
  const { clubId, placeId, name, address, description } = input;
  return db.$transaction(async (tx) => {
    await lockPlaceNames(tx, clubId);
    const place = await tx.place.findFirst({
      where: { id: placeId, clubId },
      select: { archivedAt: true },
    });
    if (!place) return false;
    if (place.archivedAt === null) {
      const existing = await findActiveSameName(tx, clubId, name, placeId);
      if (existing) throw new PlaceNameTakenError(existing);
    }
    const { count } = await tx.place.updateMany({
      where: { id: placeId, clubId },
      data: { name, nameKey: placeNameKey(name), address, description },
    });
    return count === 1;
  });
}

/**
 * "Det er mit sted" / "Fjern mig som ejer" (§9.4): sets the DESIRED state, so
 * a double tap is harmless. 'not-found' when the place is not in the club or
 * the user is not a member (the composite FKs refuse the row, D-096). Not an
 * interactive transaction, so catching the FK error is safe.
 */
export async function setPlaceOwnership(input: {
  clubId: string;
  placeId: string;
  userId: string;
  owned: boolean;
}): Promise<"ok" | "not-found"> {
  const { clubId, placeId, userId, owned } = input;
  if (!owned) {
    await db.placeOwner.deleteMany({ where: { placeId, clubId, userId } });
    return "ok";
  }
  try {
    await db.placeOwner.createMany({
      data: [{ placeId, clubId, userId }],
      skipDuplicates: true,
    });
    return "ok";
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return "not-found";
    }
    throw error;
  }
}

export type RemovePlaceResult =
  | { status: "deleted" | "archived" | "not-found" | "forbidden" }
  /** E5: the place is an option in a poll that is not finished. Nothing written. */
  | { status: "in-active-poll"; poll: { id: string; title: string } };

/**
 * The one removal action (§9.4, D-100, D-132): an unused place (no events, no
 * poll options) is deleted, a used one archived, and a place in an OPEN or
 * AWAITING_DECISION poll neither (E5). Decided under the place's FOR UPDATE
 * lock, which also blocks new events and poll options from choosing it
 * meanwhile (their FK check needs KEY SHARE; createPoll holds it FOR SHARE),
 * so the usage counts are exact. Polls are only READ here, never locked, so a
 * close that holds its poll and waits for this place cannot deadlock with it.
 * The permission (canRemovePlace) is checked again with the locked row;
 * `actorRole` is the actor's membership role.
 */
export async function removePlace(input: {
  clubId: string;
  placeId: string;
  actorUserId: string;
  actorRole: ClubRole;
}): Promise<RemovePlaceResult> {
  const { clubId, placeId, actorUserId, actorRole } = input;
  return db.$transaction(async (tx) => {
    const place = await lockPlace(tx, clubId, placeId, "UPDATE");
    if (!place || place.archivedAt !== null) return { status: "not-found" };

    const owners = await tx.placeOwner.findMany({
      where: { placeId, clubId },
      select: { userId: true },
    });
    const activeWhere = {
      clubId,
      status: { in: [...ACTIVE_POLL_STATUSES] },
      options: { some: { placeId } },
    } satisfies Prisma.PollWhereInput;
    const eventCount = await tx.event.count({ where: { clubId, placeId } });
    const pollOptionCount = await tx.pollOption.count({ where: { clubId, placeId } });
    const activePolls = await tx.poll.findMany({
      where: activeWhere,
      select: { id: true, title: true },
      orderBy: [{ deadline: "asc" }, { id: "asc" }],
    });
    const [activePoll] = activePolls;
    const activePollCount = activePolls.length;
    const access = {
      createdById: place.createdById,
      ownerIds: owners.map((owner) => owner.userId),
      archivedAt: place.archivedAt,
    };
    const usage = { eventCount, pollOptionCount, activePollCount };
    if (placeRemovalBlock(usage) !== null && activePoll) {
      return { status: "in-active-poll", poll: activePoll };
    }
    if (!canRemovePlace({ role: actorRole }, access, actorUserId, usage)) {
      return { status: "forbidden" };
    }

    if (placeRemoval(usage) === "delete") {
      await tx.place.deleteMany({ where: { id: placeId, clubId } });
      return { status: "deleted" };
    }
    await tx.place.updateMany({ where: { id: placeId, clubId }, data: { archivedAt: new Date() } });
    return { status: "archived" };
  });
}

/**
 * "Gendan sted": makes an archived place active again. Throws
 * PlaceNameTakenError when an active place has the same name meanwhile.
 * Permission (owner or admin, canRestorePlace) is the caller's job.
 */
export async function restorePlace(input: {
  clubId: string;
  placeId: string;
}): Promise<"restored" | "already-active" | "not-found"> {
  const { clubId, placeId } = input;
  return db.$transaction(async (tx) => {
    await lockPlaceNames(tx, clubId);
    const locked = await lockPlace(tx, clubId, placeId, "UPDATE");
    if (!locked) return "not-found";
    if (locked.archivedAt === null) return "already-active";

    const place = await tx.place.findFirstOrThrow({
      where: { id: placeId, clubId },
      select: { name: true },
    });
    const existing = await findActiveSameName(tx, clubId, place.name, placeId);
    if (existing) throw new PlaceNameTakenError(existing);

    await tx.place.updateMany({ where: { id: placeId, clubId }, data: { archivedAt: null } });
    return "restored";
  });
}

/**
 * "＋ Nyt sted" in the event form (D-099), inside the event's transaction: an
 * ACTIVE place with the same name is reused (and locked FOR SHARE, so it
 * cannot be archived or deleted before the event points at it); otherwise
 * the place is created. `ownedByCreator` makes the creator an owner either
 * way (if still a member). Returns the place's owners, for the default hosts.
 */
export async function findOrCreatePlaceTx(
  tx: Tx,
  input: {
    clubId: string;
    createdById: string;
    name: string;
    address: string | null;
    ownedByCreator: boolean;
  },
): Promise<{ placeId: string; ownerIds: string[]; created: boolean }> {
  const { clubId, createdById, name, address, ownedByCreator } = input;
  await lockPlaceNames(tx, clubId);

  const existing = await findActiveSameName(tx, clubId, name);
  if (existing) {
    // removePlace does not take the name lock: re-check under the row lock.
    const locked = await lockPlace(tx, clubId, existing.id, "SHARE");
    if (locked && locked.archivedAt === null) {
      if (ownedByCreator) {
        await addOwnerIfMember(tx, { clubId, placeId: existing.id, userId: createdById });
      }
      const owners = await tx.placeOwner.findMany({
        where: { placeId: existing.id, clubId },
        select: { userId: true },
        orderBy: { createdAt: "asc" },
      });
      return {
        placeId: existing.id,
        ownerIds: owners.map((owner) => owner.userId),
        created: false,
      };
    }
  }

  const place = await tx.place.create({
    data: { clubId, createdById, name, nameKey: placeNameKey(name), address },
    select: { id: true },
  });
  const owned =
    ownedByCreator &&
    (await addOwnerIfMember(tx, { clubId, placeId: place.id, userId: createdById }));
  return { placeId: place.id, ownerIds: owned ? [createdById] : [], created: true };
}
