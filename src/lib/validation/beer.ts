import { z } from "zod";

import { isValidId } from "@/lib/ids";
import { ABV_ERROR_MESSAGES, parseAbvInput } from "@/server/domain/beers/abv";
import { BEER_NAME_MAX_LENGTH, cleanBeerName } from "@/server/domain/beers/name";

import { idSchema } from "./id";

/**
 * Zod schema for adding and editing a beer (SPEC §9.5), shared by the form
 * (client) and the Server Action. Messages are Danish.
 *
 *   * name: cleaned (trimmed, single spaces, NFC), 1–120 characters.
 *   * abv: the typed text ("5,2", "5.2", "5,2 %") → a number with one decimal,
 *     0–99,9. More than one decimal is refused (src/server/domain/beers/abv.ts).
 *   * eventId: optional; "" / null / missing → null. Must look like an id; the
 *     Server Action checks that the event is in the same club (§4.4).
 *   * confirmDuplicate: "1" / "true" / "on" → true. The form sends it when the
 *     member saw the duplicate warning (E21) and still wants to add the beer.
 *
 * Client-safe: the domain modules are pure.
 */

export const beerFormSchema = z.object({
  name: z
    .string({ error: "Giv øllen et navn." })
    .transform(cleanBeerName)
    .pipe(
      z
        .string()
        .min(1, "Giv øllen et navn.")
        .max(BEER_NAME_MAX_LENGTH, `Navnet må højst være ${BEER_NAME_MAX_LENGTH} tegn.`),
    ),
  abv: z
    .union([z.string(), z.number()])
    .nullish()
    .transform((value, ctx) => {
      const result = parseAbvInput(value ?? "");
      if (!result.ok) {
        ctx.addIssue({ code: "custom", message: ABV_ERROR_MESSAGES[result.reason] });
        return z.NEVER;
      }
      return result.value;
    }),
  eventId: z
    .string()
    .nullish()
    .transform((value) => (value ?? "").trim())
    .refine((value) => value === "" || isValidId(value), "Vælg et event fra listen.")
    .transform((value) => (value === "" ? null : value)),
  confirmDuplicate: z
    .union([z.string(), z.boolean()])
    .nullish()
    .transform((value) => value === true || value === "1" || value === "true" || value === "on"),
});

export type BeerFormInput = z.input<typeof beerFormSchema>;
export type BeerFormData = z.output<typeof beerFormSchema>;

/**
 * Which beer a Server Action is about (delete, rate, remove rating). The
 * actions turn a failed parse into notFound() (§4.4, E22).
 */
export const beerRefSchema = z.object({ clubId: idSchema, beerId: idSchema });
