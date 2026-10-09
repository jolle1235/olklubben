import "server-only";

import { db } from "@/server/db";

/**
 * Writes for events (SPEC §9.2, D-061).
 *
 * Authorization is the caller's job (the Server Actions): membership with
 * requireMembership(clubId), and canEditEvent/canDeleteEvent for changes.
 * These functions trust their arguments but always scope by clubId (§4.4), so
 * an event of another club is never touched – the result says "not found".
 */

/** What the event form stores (= EventFormData from src/lib/validation/event.ts). */
export type EventWriteData = {
  title: string;
  theme: string | null;
  description: string | null;
  locationText: string;
  startsAt: Date;
  endsAt: Date | null;
};

export async function createEvent(
  input: { clubId: string; createdById: string } & EventWriteData,
): Promise<{ id: string }> {
  const { clubId, createdById, ...data } = input;
  return db.event.create({ data: { clubId, createdById, ...data }, select: { id: true } });
}

/** Updates the event if it is in the club. Returns false when it is not (→ 404). */
export async function updateEvent(
  input: { clubId: string; eventId: string } & EventWriteData,
): Promise<boolean> {
  const { clubId, eventId, ...data } = input;
  const { count } = await db.event.updateMany({ where: { id: eventId, clubId }, data });
  return count === 1;
}

/**
 * Deletes the event if it is in the club. Its beers stay in the catalogue with
 * eventId = null, ratings included (E13, ON DELETE SET NULL). Returns how many
 * beers lost the link, for the confirmation toast.
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
