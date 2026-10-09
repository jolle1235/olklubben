import { z } from "zod";

import { isValidId } from "@/lib/ids";
import { stripNul } from "@/lib/text";
import { MAX_EVENT_HOSTS } from "@/server/domain/events/hosts";
import { isDateKey, normalizeTimeOfDay, resolveEventTimes } from "@/server/domain/events/time";
import {
  cleanPlaceName,
  PLACE_ADDRESS_MAX_LENGTH,
  PLACE_NAME_MAX_LENGTH,
} from "@/server/domain/places/name";

import {
  checkboxSchema,
  cleanOptionalText,
  idListSchema,
  optionalText,
  rawTextLimit,
} from "./text";

/**
 * Zod schema for creating and editing an event (SPEC §9.2, D-098, D-099),
 * shared by the form (client) and the Server Action. Messages are Danish.
 *
 * Input: the form's strings (FormData values read with readFormValues and
 * EVENT_ARRAY_FIELDS; optional fields may be missing, null or ""). Date
 * "YYYY-MM-DD" and times "HH:mm" are Copenhagen wall-clock values
 * (<input type="date">, <input type="time">). The form's default start time
 * 18:30 is a UI default (DEFAULT_EVENT_START_TIME), not part of the schema.
 *
 *   * placeId: one of the club's places, or EVENT_PLACE_NEW ("new") for
 *     "＋ Nyt sted" – then newPlaceName (required), newPlaceAddress and
 *     newPlaceMine ("Det er mit sted") describe it. The new-place fields are
 *     ignored when an existing place is chosen. Whether the place exists in the
 *     club and is not archived is checked on the server
 *     (PlaceNotSelectableError → fieldErrors.placeId).
 *   * hostIds: the chosen hosts (repeated field). Empty = the default (the
 *     place's owners, else the creator); the server checks membership
 *     (InvalidEventHostsError → fieldErrors.hostIds).
 *
 * Output: trimmed texts without U+0000 (Postgres text cannot store it; empty
 * optional texts → null, line breaks in the description kept as "\n"), UTC
 * instants `startsAt`/`endsAt`, the place choice and the host ids. Overnight
 * rule (src/server/domain/events/time.ts): an end time before the start time
 * ends the next day; an end time equal to the start time is refused.
 * Events in the past are allowed (registering old tastings, §9.2).
 *
 * Field names and the output type are part of the round-3 contract.
 *
 * Client-safe: the domain modules are pure.
 */

export const EVENT_TITLE_MAX_LENGTH = 100;
export const EVENT_THEME_MAX_LENGTH = 80;
export const EVENT_DESCRIPTION_MAX_LENGTH = 5000;

/** The placeId value of "＋ Nyt sted". */
export const EVENT_PLACE_NEW = "new";
/** Repeated form fields (readFormValues / useActionForm `arrays`). */
export const EVENT_ARRAY_FIELDS = ["hostIds"] as const;

const PLACE_REQUIRED_MESSAGE = "Vælg et sted, eller opret et nyt.";
const PLACE_INVALID_MESSAGE = "Vælg et sted fra listen.";
/** Round 2's message, kept on purpose (the interim form and its E2E tests). */
export const NEW_PLACE_NAME_REQUIRED_MESSAGE = "Skriv, hvor I mødes.";
const NEW_PLACE_NAME_TOO_LONG = `Navnet må højst være ${PLACE_NAME_MAX_LENGTH} tegn.`;
const NEW_PLACE_ADDRESS_TOO_LONG = `Adressen må højst være ${PLACE_ADDRESS_MAX_LENGTH} tegn.`;
/** A raw new-place name longer than this is refused before it is cleaned (D-090). */
const NEW_PLACE_NAME_RAW_MAX_LENGTH = 2000;

/** Where the event is: an existing place of the club, or a new one created with the event. */
export type EventPlaceChoice =
  | { kind: "existing"; placeId: string }
  | { kind: "new"; name: string; address: string | null; ownedByCreator: boolean };

// `abort: true`: an empty field shows only "required", not also "invalid" (Zod 4
// runs the remaining checks after a failed one unless told to stop).
const timeField = (required: string, invalid: string) =>
  z
    .string({ error: required })
    .trim()
    .min(1, { error: required, abort: true })
    .refine((value) => normalizeTimeOfDay(value) !== null, invalid)
    .transform((value) => normalizeTimeOfDay(value) as string);

export const eventFieldsSchema = z.object({
  title: z
    .string({ error: "Giv eventet en titel." })
    .overwrite(stripNul)
    .trim()
    .min(1, "Giv eventet en titel.")
    .max(EVENT_TITLE_MAX_LENGTH, `Titlen må højst være ${EVENT_TITLE_MAX_LENGTH} tegn.`),
  // One check instead of min(1, { abort: true }) + refine: an aborted issue
  // makes Zod skip the object-level refinement below, so "same start and end"
  // would only show once the date was fixed.
  date: z
    .string({ error: "Vælg en dato." })
    .trim()
    .superRefine((value, ctx) => {
      if (value === "") ctx.addIssue({ code: "custom", message: "Vælg en dato." });
      else if (!isDateKey(value)) {
        ctx.addIssue({ code: "custom", message: "Datoen findes ikke. Vælg en anden dato." });
      }
    }),
  startTime: timeField("Vælg et starttidspunkt.", "Skriv tiden som tt:mm, fx 18:30."),
  endTime: z
    .string()
    .nullish()
    .transform((value) => (value ?? "").trim())
    .refine((value) => value === "" || normalizeTimeOfDay(value) !== null, {
      message: "Skriv sluttiden som tt:mm, fx 23:00.",
    })
    .transform((value) => (value === "" ? null : (normalizeTimeOfDay(value) as string))),
  // One check with one message: "" → required; anything but "new" or an id → invalid.
  placeId: z
    .string({ error: PLACE_REQUIRED_MESSAGE })
    .superRefine((raw, ctx) => {
      const value = raw.trim();
      if (value === "") {
        ctx.addIssue({ code: "custom", message: PLACE_REQUIRED_MESSAGE });
      } else if (raw.length > 64 || (value !== EVENT_PLACE_NEW && !isValidId(value))) {
        ctx.addIssue({ code: "custom", message: PLACE_INVALID_MESSAGE });
      }
    })
    .transform((value) => value.trim()),
  // Required and ≤ 120 only for "＋ Nyt sted" (object-level checks below), so a
  // name typed before switching to an existing place never blocks the form.
  newPlaceName: z
    .string()
    .max(NEW_PLACE_NAME_RAW_MAX_LENGTH, NEW_PLACE_NAME_TOO_LONG)
    .nullish()
    .transform((value) => cleanPlaceName(value ?? "")),
  // Cleaned like the place form's address; ≤ 200 only for "＋ Nyt sted" (below).
  newPlaceAddress: z
    .string()
    .max(rawTextLimit(PLACE_ADDRESS_MAX_LENGTH), NEW_PLACE_ADDRESS_TOO_LONG)
    .nullish()
    .transform((value) => cleanOptionalText(value)),
  newPlaceMine: checkboxSchema,
  hostIds: idListSchema(MAX_EVENT_HOSTS, {
    tooMany: `Der kan højst være ${MAX_EVENT_HOSTS} værter.`,
    invalid: "Vælg værter fra listen.",
  }),
  theme: optionalText(
    EVENT_THEME_MAX_LENGTH,
    `Temaet må højst være ${EVENT_THEME_MAX_LENGTH} tegn.`,
  ),
  description: optionalText(
    EVENT_DESCRIPTION_MAX_LENGTH,
    `Planen må højst være ${EVENT_DESCRIPTION_MAX_LENGTH} tegn.`,
    { multiline: true },
  ),
});

export const SAME_START_AND_END_MESSAGE = "Sluttiden skal være en anden end starttiden.";

/** The object-level checks below also run while other fields (e.g. the title) are invalid (F-037). */
const newPlaceFields = eventFieldsSchema.pick({
  placeId: true,
  newPlaceName: true,
  newPlaceAddress: true,
});
const whenNewPlaceFieldsParse = (payload: { value: unknown }) =>
  newPlaceFields.safeParse(payload.value).success;
const isNewPlace = (values: { placeId: string }) => values.placeId === EVENT_PLACE_NEW;

export const eventFormSchema = eventFieldsSchema
  .refine((values) => values.endTime === null || values.endTime !== values.startTime, {
    message: SAME_START_AND_END_MESSAGE,
    path: ["endTime"],
    when: (payload) =>
      eventFieldsSchema.pick({ startTime: true, endTime: true }).safeParse(payload.value).success,
  })
  .refine((values) => !isNewPlace(values) || values.newPlaceName !== "", {
    message: NEW_PLACE_NAME_REQUIRED_MESSAGE,
    path: ["newPlaceName"],
    when: whenNewPlaceFieldsParse,
  })
  .refine((values) => !isNewPlace(values) || values.newPlaceName.length <= PLACE_NAME_MAX_LENGTH, {
    message: NEW_PLACE_NAME_TOO_LONG,
    path: ["newPlaceName"],
    when: whenNewPlaceFieldsParse,
  })
  .refine(
    (values) =>
      !isNewPlace(values) ||
      values.newPlaceAddress === null ||
      values.newPlaceAddress.length <= PLACE_ADDRESS_MAX_LENGTH,
    {
      message: NEW_PLACE_ADDRESS_TOO_LONG,
      path: ["newPlaceAddress"],
      when: whenNewPlaceFieldsParse,
    },
  )
  .transform((values, ctx) => {
    const times = resolveEventTimes({
      date: values.date,
      startTime: values.startTime,
      endTime: values.endTime,
    });
    if (!times.ok) {
      // Only reachable inside a DST gap (the fields themselves are valid here).
      ctx.addIssue({
        code: "custom",
        path: [times.field],
        message:
          times.reason === "same-as-start"
            ? SAME_START_AND_END_MESSAGE
            : "Tidspunktet findes ikke den dag (sommertid). Vælg et andet.",
      });
      return z.NEVER;
    }
    const place: EventPlaceChoice = isNewPlace(values)
      ? {
          kind: "new",
          name: values.newPlaceName,
          address: values.newPlaceAddress,
          ownedByCreator: values.newPlaceMine,
        }
      : { kind: "existing", placeId: values.placeId };
    return {
      title: values.title,
      theme: values.theme,
      description: values.description,
      startsAt: times.startsAt,
      endsAt: times.endsAt,
      place,
      hostIds: values.hostIds,
    };
  });

/** The form's raw values (as typed). */
export type EventFormInput = z.input<typeof eventFormSchema>;
/** What createEvent/updateEvent store (the data layer's EventWriteData). */
export type EventFormData = {
  title: string;
  theme: string | null;
  description: string | null;
  startsAt: Date;
  endsAt: Date | null;
  place: EventPlaceChoice;
  hostIds: string[];
};

// The schema's output must stay exactly the contract type above.
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _outputIsContract: Exact<z.output<typeof eventFormSchema>, EventFormData> = true;
void _outputIsContract;
