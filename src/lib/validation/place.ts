import { z } from "zod";

import {
  cleanPlaceName,
  PLACE_ADDRESS_MAX_LENGTH,
  PLACE_DESCRIPTION_MAX_LENGTH,
  PLACE_NAME_MAX_LENGTH,
} from "@/server/domain/places/name";

import { idSchema } from "./id";
import { checkboxSchema, optionalText } from "./text";

/**
 * Zod schemas for places (SPEC §9.4, D-095, D-100), shared by the place form
 * (client) and the Server Actions. Messages are Danish.
 *
 *   * name: cleaned (cleanPlaceName: NUL removed, NFC, whitespace collapsed),
 *     1–120 characters. Whether another ACTIVE place has the same name is
 *     decided in the data layer (PlaceNameTakenError → fieldErrors.name).
 *   * address: optional, ≤ 200 ("Åbn i kort" searches it, D-101).
 *   * description: optional, ≤ 1000, line breaks kept.
 *
 * Client-safe: the domain module is pure.
 */

const NAME_REQUIRED = "Giv stedet et navn.";
const NAME_TOO_LONG = `Navnet må højst være ${PLACE_NAME_MAX_LENGTH} tegn.`;
/** A raw name longer than this is refused before it is cleaned (D-090). */
const NAME_RAW_MAX_LENGTH = 2000;

export const placeFieldsSchema = z.object({
  name: z
    .string({ error: NAME_REQUIRED })
    .max(NAME_RAW_MAX_LENGTH, NAME_TOO_LONG)
    .transform(cleanPlaceName)
    .pipe(z.string().min(1, NAME_REQUIRED).max(PLACE_NAME_MAX_LENGTH, NAME_TOO_LONG)),
  address: optionalText(
    PLACE_ADDRESS_MAX_LENGTH,
    `Adressen må højst være ${PLACE_ADDRESS_MAX_LENGTH} tegn.`,
  ),
  description: optionalText(
    PLACE_DESCRIPTION_MAX_LENGTH,
    `Beskrivelsen må højst være ${PLACE_DESCRIPTION_MAX_LENGTH} tegn.`,
    { multiline: true },
  ),
});

/** "Opret sted": the fields plus "Det er mit sted" (the creator becomes an owner). */
export const createPlaceSchema = placeFieldsSchema.extend({ makeMeOwner: checkboxSchema });

/** Which place a Server Action is about. A failed parse → notFound() (§4.4, E22). */
export const placeRefSchema = z.object({ clubId: idSchema, placeId: idSchema });

/** An owner of a place (an admin removes another owner). */
export const placeOwnerRefSchema = placeRefSchema.extend({ userId: idSchema });

/** The owner toggle sends the desired state ("Det er mit sted" / "Fjern mig som ejer"). */
export const ownPlaceOwnershipSchema = placeRefSchema.extend({ owned: z.boolean() });

export type PlaceFieldsInput = z.input<typeof placeFieldsSchema>;
export type PlaceFieldsData = z.output<typeof placeFieldsSchema>;
export type CreatePlaceData = z.output<typeof createPlaceSchema>;
