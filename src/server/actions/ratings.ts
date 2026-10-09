"use server";

import { notFound } from "next/navigation";

import {
  ACTION_ERROR_CODES,
  DEFAULT_ERROR_MESSAGES,
  fail,
  ok,
  unexpectedError,
  validationError,
  type ActionError,
  type ActionResult,
} from "@/lib/action-result";
import { beerRefSchema } from "@/lib/validation/beer";
import { ratingValueSchema } from "@/lib/validation/rating";
import { requireMembership } from "@/server/auth/session";
import { removeRating, setRating } from "@/server/beers/mutations";
import { canRateBeer } from "@/server/domain/beers/permissions";
import { revalidateClub } from "@/server/revalidate";

/**
 * Server Actions for a member's OWN rating of a beer (SPEC §9.5, D-003, §4.3).
 * Any member may rate any beer of the club; the user id always comes from the
 * session, never from the client, so nobody can set someone else's rating.
 *
 * Called from <BeerRating /> with optimistic UI. Both revalidate the club, so
 * the response re-renders the beer page with the new average, count and list.
 * A beer that is not in the club (or a malformed id) → 404 (E22).
 */

export type RatingInput = { clubId: string; beerId: string; value: number };

type RatingAccess = { ok: true; clubId: string; beerId: string; userId: string };

/** §4.3 steps 1–3 + the can* check. Malformed ids → 404; not a member → 404. */
async function requireRatingAccess(input: {
  clubId?: unknown;
  beerId?: unknown;
}): Promise<RatingAccess | { ok: false; error: ActionError }> {
  const ids = beerRefSchema.safeParse({ clubId: input?.clubId, beerId: input?.beerId });
  if (!ids.success) notFound();

  const { user, membership, club } = await requireMembership(ids.data.clubId);
  if (!canRateBeer(membership)) {
    return fail(ACTION_ERROR_CODES.FORBIDDEN, DEFAULT_ERROR_MESSAGES.FORBIDDEN);
  }
  return { ok: true, clubId: club.id, beerId: ids.data.beerId, userId: user.id };
}

/** Runs the write; false (the beer is not in the club) → 404. Then revalidates the club. */
async function writeRating<T>(
  access: RatingAccess,
  write: () => Promise<boolean>,
  data: T,
): Promise<ActionResult<T>> {
  let found: boolean;
  try {
    found = await write();
  } catch (error) {
    console.error("[ratings] saving a rating failed", error);
    return unexpectedError();
  }
  if (!found) notFound();

  revalidateClub(access.clubId);
  return ok(data);
}

/** Sets (first time or change) the user's rating: value 2..10 (half points). */
export async function rateBeerAction(input: RatingInput): Promise<ActionResult<{ value: number }>> {
  const value = ratingValueSchema.safeParse(input?.value);
  if (!value.success) return validationError(value.error);
  const access = await requireRatingAccess(input);
  if (!access.ok) return access;

  const { clubId, beerId, userId } = access;
  return writeRating(access, () => setRating({ clubId, beerId, userId, value: value.data }), {
    value: value.data,
  });
}

/** Removes the user's own rating ("Fjern min rating"). No rating is fine. */
export async function removeRatingAction(input: {
  clubId: string;
  beerId: string;
}): Promise<ActionResult<null>> {
  const access = await requireRatingAccess(input);
  if (!access.ok) return access;

  const { clubId, beerId, userId } = access;
  return writeRating(access, () => removeRating({ clubId, beerId, userId }), null);
}
