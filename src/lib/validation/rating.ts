import { z } from "zod";

import { RATING_MAX, RATING_MIN } from "@/server/domain/ratings/ratings";

/**
 * Zod schema for a member's own rating (SPEC §9.5, D-003): an integer 2..10
 * in half points (2 = 1 star, 10 = 5 stars). Strings from a form ("9") are
 * accepted. Messages are Danish.
 *
 * Deliberately no combined { beerId, value } schema: rateBeerAction parses the
 * value with this one and the ids with beerRefSchema, so a malformed id gives
 * 404 (E22), never a field error.
 *
 * Client-safe.
 */

export const RATING_VALUE_MESSAGE = "Vælg mellem 1 og 5 stjerner.";

export const ratingValueSchema = z.coerce
  .number({ error: RATING_VALUE_MESSAGE })
  .int(RATING_VALUE_MESSAGE)
  .min(RATING_MIN, RATING_VALUE_MESSAGE)
  .max(RATING_MAX, RATING_VALUE_MESSAGE);
