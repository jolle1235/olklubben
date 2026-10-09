import "server-only";

import { db, type TransactionClient } from "@/server/db";
import { isValidRatingValue } from "@/server/domain/ratings/ratings";

/**
 * Writes for beers and ratings (SPEC §9.5, §5.1, D-063).
 *
 * Authorization is the caller's job (the Server Actions): membership with
 * requireMembership(clubId), and canEditBeer/canDeleteBeer for changes. These
 * functions trust their arguments but always scope by clubId (§4.4):
 *
 *   * a beer of another club is never touched – the result says "not found";
 *   * a beer can only be linked to an event of the SAME club. Anything else
 *     throws EventNotInClubError (the action shows it on the event field).
 *     The database cannot check this: a composite FK with ON DELETE SET NULL
 *     would also null club_id.
 */

export class EventNotInClubError extends Error {
  readonly code = "EVENT_NOT_IN_CLUB";

  constructor() {
    super("The event does not exist in this club.");
    this.name = "EventNotInClubError";
  }
}

/** What the beer form stores (from beerFormSchema in src/lib/validation/beer.ts). */
export type BeerWriteData = {
  name: string;
  /** 0.0–99.9 with one decimal. */
  abv: number;
  eventId: string | null;
};

async function assertEventInClub(
  tx: TransactionClient,
  clubId: string,
  eventId: string | null,
): Promise<void> {
  if (eventId === null) return;
  const event = await tx.event.findFirst({ where: { id: eventId, clubId }, select: { id: true } });
  if (!event) throw new EventNotInClubError();
}

/** Decimal(3,1) from a number, exactly: 5.2 → "5.2". */
function toDecimalString(abv: number): string {
  return abv.toFixed(1);
}

/** Prisma's "foreign key constraint failed" (e.g. the beer was deleted meanwhile). */
function isForeignKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2003";
}

/** Adds a beer to the club. Throws EventNotInClubError for an event outside the club. */
export async function createBeer(
  input: { clubId: string; createdById: string } & BeerWriteData,
): Promise<{ id: string }> {
  const { clubId, createdById, name, abv, eventId } = input;
  return db.$transaction(async (tx) => {
    await assertEventInClub(tx, clubId, eventId);
    return tx.beer.create({
      data: { clubId, createdById, name, abv: toDecimalString(abv), eventId },
      select: { id: true },
    });
  });
}

/**
 * Updates the beer if it is in the club; false when it is not (→ 404).
 * Throws EventNotInClubError for an event outside the club.
 */
export async function updateBeer(
  input: { clubId: string; beerId: string } & BeerWriteData,
): Promise<boolean> {
  const { clubId, beerId, name, abv, eventId } = input;
  return db.$transaction(async (tx) => {
    await assertEventInClub(tx, clubId, eventId);
    const { count } = await tx.beer.updateMany({
      where: { id: beerId, clubId },
      data: { name, abv: toDecimalString(abv), eventId },
    });
    return count === 1;
  });
}

/**
 * Deletes the beer if it is in the club. Its ratings go with it (E14, CASCADE);
 * `ratingCount` is how many, for the confirmation message.
 */
export async function deleteBeer(input: {
  clubId: string;
  beerId: string;
}): Promise<{ deleted: boolean; ratingCount: number }> {
  const { clubId, beerId } = input;
  return db.$transaction(async (tx) => {
    const ratingCount = await tx.beerRating.count({ where: { beerId, beer: { clubId } } });
    const { count } = await tx.beer.deleteMany({ where: { id: beerId, clubId } });
    return { deleted: count === 1, ratingCount: count === 1 ? ratingCount : 0 };
  });
}

/**
 * Sets the user's own rating of a beer of the club (first time or change):
 * one row per (beer, user), upserted. Returns false when the beer is not in
 * the club (→ 404). `value` must be 2..10 (RangeError otherwise).
 */
export async function setRating(input: {
  clubId: string;
  beerId: string;
  userId: string;
  value: number;
}): Promise<boolean> {
  const { clubId, beerId, userId, value } = input;
  if (!isValidRatingValue(value)) throw new RangeError(`Invalid rating value: ${value}`);
  try {
    return await db.$transaction(async (tx) => {
      const beer = await tx.beer.findFirst({ where: { id: beerId, clubId }, select: { id: true } });
      if (!beer) return false;
      await tx.beerRating.upsert({
        where: { beerId_userId: { beerId, userId } },
        create: { beerId, userId, value },
        update: { value },
      });
      return true;
    });
  } catch (error) {
    // The beer was deleted between the check and the write.
    if (isForeignKeyError(error)) return false;
    throw error;
  }
}

/**
 * Removes the user's own rating (no-op when there is none). Returns false when
 * the beer is not in the club (→ 404).
 */
export async function removeRating(input: {
  clubId: string;
  beerId: string;
  userId: string;
}): Promise<boolean> {
  const { clubId, beerId, userId } = input;
  return db.$transaction(async (tx) => {
    const beer = await tx.beer.findFirst({ where: { id: beerId, clubId }, select: { id: true } });
    if (!beer) return false;
    await tx.beerRating.deleteMany({ where: { beerId, userId } });
    return true;
  });
}
