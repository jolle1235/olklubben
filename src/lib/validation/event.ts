import { z } from "zod";

import { stripNul } from "@/lib/text";
import { isDateKey, normalizeTimeOfDay, resolveEventTimes } from "@/server/domain/events/time";

/**
 * Zod schema for creating and editing an event (SPEC §9.2, D-022), shared by
 * the form (client) and the Server Action. Messages are Danish.
 *
 * Input: the form's strings (FormData values; optional fields may be missing,
 * null or ""). Date "YYYY-MM-DD" and times "HH:mm" are Copenhagen wall-clock
 * values (<input type="date">, <input type="time">). The form's default start
 * time 18:30 is a UI default (DEFAULT_EVENT_START_TIME), not part of the schema.
 *
 * Output: trimmed texts without U+0000 (Postgres text cannot store it; empty
 * optional texts → null, line breaks in the description kept as "\n") and UTC instants `startsAt`/`endsAt`. Overnight
 * rule (src/server/domain/events/time.ts): an end time before the start time
 * ends the next day; an end time equal to the start time is refused.
 * Events in the past are allowed (registering old tastings, §9.2).
 *
 * Client-safe: the domain module is pure.
 */

export const EVENT_TITLE_MAX_LENGTH = 100;
export const EVENT_THEME_MAX_LENGTH = 80;
export const EVENT_DESCRIPTION_MAX_LENGTH = 5000;
export const EVENT_LOCATION_MAX_LENGTH = 120;

/** "" / null / missing → null; otherwise NUL-free and trimmed (max length checked after that). */
function optionalText(max: number, tooLong: string, multiline = false) {
  return z
    .string()
    .nullish()
    .transform((value) => {
      const text = stripNul(value ?? "")
        .replace(/\r\n?/g, "\n")
        .trim();
      return text === "" ? null : multiline ? text : text.replace(/\s+/g, " ");
    })
    .refine((value) => value === null || value.length <= max, tooLong);
}

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
  locationText: z
    .string({ error: "Skriv, hvor I mødes." })
    .overwrite(stripNul)
    .trim()
    .min(1, "Skriv, hvor I mødes.")
    .max(EVENT_LOCATION_MAX_LENGTH, `Stedet må højst være ${EVENT_LOCATION_MAX_LENGTH} tegn.`),
  theme: optionalText(
    EVENT_THEME_MAX_LENGTH,
    `Temaet må højst være ${EVENT_THEME_MAX_LENGTH} tegn.`,
  ),
  description: optionalText(
    EVENT_DESCRIPTION_MAX_LENGTH,
    `Planen må højst være ${EVENT_DESCRIPTION_MAX_LENGTH} tegn.`,
    true,
  ),
});

export const SAME_START_AND_END_MESSAGE = "Sluttiden skal være en anden end starttiden.";

export const eventFormSchema = eventFieldsSchema
  .refine((values) => values.endTime === null || values.endTime !== values.startTime, {
    message: SAME_START_AND_END_MESSAGE,
    path: ["endTime"],
    // Also while other fields (e.g. the title) are still invalid.
    when: (payload) =>
      eventFieldsSchema.pick({ startTime: true, endTime: true }).safeParse(payload.value).success,
  })
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
    return {
      title: values.title,
      theme: values.theme,
      description: values.description,
      locationText: values.locationText,
      startsAt: times.startsAt,
      endsAt: times.endsAt,
    };
  });

/** The form's raw values (as typed). */
export type EventFormInput = z.input<typeof eventFormSchema>;
/** What createEvent/updateEvent store. */
export type EventFormData = z.output<typeof eventFormSchema>;
