import { z } from "zod";

import { isValidId } from "@/lib/ids";
import { stripNul } from "@/lib/text";
import { isDateKey, normalizeTimeOfDay } from "@/server/domain/events/time";

/**
 * Building blocks for the Zod schemas in src/lib/validation (D-090): every
 * free-text field strips U+0000 and has a length cap BEFORE any cleaning or
 * regex runs, empty optional texts become null, and messages are Danish.
 *
 * Client-safe: no server-only imports.
 */

/**
 * The raw length an optional text may have before it is cleaned. Generous
 * (whitespace may shrink a valid text a lot), but bounded, so a forged
 * request never sends megabytes through the regexes below.
 */
export function rawTextLimit(max: number): number {
  return Math.max(max * 4, max + 1000);
}

/**
 * How optional texts are stored: "" / null / missing → null; otherwise
 * NUL-free and trimmed. Single-line texts get their whitespace collapsed to
 * one space; `multiline` keeps the line breaks (CRLF → "\n").
 */
export function cleanOptionalText(
  value: string | null | undefined,
  opts: { multiline?: boolean } = {},
): string | null {
  const text = stripNul(value ?? "")
    .replace(/\r\n?/g, "\n")
    .trim();
  if (text === "") return null;
  return opts.multiline ? text : text.replace(/\s+/g, " ");
}

/**
 * An optional text (cleanOptionalText) of at most `max` characters, checked
 * on the cleaned text. The raw input is capped first (rawTextLimit).
 */
export function optionalText(max: number, tooLong: string, opts: { multiline?: boolean } = {}) {
  return z
    .string()
    .max(rawTextLimit(max), tooLong)
    .nullish()
    .transform((value) => cleanOptionalText(value, opts))
    .refine((value) => value === null || value.length <= max, tooLong);
}

/**
 * A native checkbox: "on" (the browser's default value), "true" or "1" →
 * true; anything else, missing included, → false.
 */
export const checkboxSchema = z
  .union([z.string().max(10), z.boolean()])
  .nullish()
  .transform((value) => value === true || value === "on" || value === "true" || value === "1");

const ID_MAX_LENGTH = 64;

/**
 * One optional id from a radio group, a select or a hidden field: "" or
 * missing → null; anything else must be a valid id (`invalid` otherwise).
 */
export function optionalId(invalid: string) {
  return z
    .string()
    .max(ID_MAX_LENGTH, { error: invalid, abort: true })
    .nullish()
    .transform((value) => {
      const trimmed = (value ?? "").trim();
      return trimmed === "" ? null : trimmed;
    })
    .refine((value) => value === null || isValidId(value), invalid);
}

/**
 * A list of ids from repeated form fields (checkbox lists, fx hostIds; read
 * with readFormValues' `arrays`). Missing → []. At most `max` entries, each a
 * valid id; duplicates are removed (first occurrence wins).
 */
export function idListSchema(max: number, messages: { tooMany: string; invalid: string }) {
  return z
    .union([z.array(z.string()), z.string()])
    .nullish()
    .transform((value) => (value == null ? [] : Array.isArray(value) ? value : [value]))
    .pipe(
      // One check with one message on the field itself (never "hostIds.0").
      z.array(z.string()).superRefine((ids, ctx) => {
        if (ids.length > max) {
          ctx.addIssue({ code: "custom", message: messages.tooMany });
        } else if (!ids.every((id) => id.length <= ID_MAX_LENGTH && isValidId(id))) {
          ctx.addIssue({ code: "custom", message: messages.invalid });
        }
      }),
    )
    .transform((ids) => [...new Set(ids)]);
}

// ── Dates and times ─────────────────────────────────────────────────────────

export const DATE_INVALID = "Datoen findes ikke. Vælg en anden dato.";
/** A raw date or time longer than this is refused before it is trimmed or parsed (D-090). */
const DATE_TIME_RAW_MAX_LENGTH = 20;

/** A required "HH:mm". `abort: true`: an empty field shows only "required", not also "invalid". */
export const timeField = (required: string, invalid: string) =>
  z
    .string({ error: required })
    .max(DATE_TIME_RAW_MAX_LENGTH, { error: invalid, abort: true })
    .trim()
    .min(1, { error: required, abort: true })
    .refine((value) => normalizeTimeOfDay(value) !== null, invalid)
    .transform((value) => normalizeTimeOfDay(value) as string);

/** An optional "HH:mm": "" (or missing) stays "". */
export const optionalTimeField = (invalid: string) =>
  z
    .string()
    .max(DATE_TIME_RAW_MAX_LENGTH, { error: invalid, abort: true })
    .nullish()
    .transform((value) => (value ?? "").trim())
    .refine((value) => value === "" || normalizeTimeOfDay(value) !== null, { message: invalid })
    .transform((value) => (value === "" ? "" : (normalizeTimeOfDay(value) as string)));

/**
 * A required "YYYY-MM-DD". One check instead of min(1, { abort: true }) +
 * refine: an aborted issue would make Zod skip the object-level checks (F-037).
 */
export const dateField = (required: string) =>
  z
    .string({ error: required })
    .max(DATE_TIME_RAW_MAX_LENGTH, { error: DATE_INVALID, abort: true })
    .trim()
    .superRefine((value, ctx) => {
      if (value === "") ctx.addIssue({ code: "custom", message: required });
      else if (!isDateKey(value)) ctx.addIssue({ code: "custom", message: DATE_INVALID });
    });

/** An optional "YYYY-MM-DD": "" (or missing) stays "". */
export const optionalDateField = () =>
  z
    .string()
    .max(DATE_TIME_RAW_MAX_LENGTH, { error: DATE_INVALID, abort: true })
    .nullish()
    .transform((value) => (value ?? "").trim())
    .refine((value) => value === "" || isDateKey(value), { message: DATE_INVALID });

// ── Object-level checks ─────────────────────────────────────────────────────

/**
 * A `when` for an object-level check: run it only when the fields it reads are
 * valid, also while other fields are not (F-037).
 */
export function whenValid<S extends z.ZodRawShape>(
  schema: z.ZodObject<S>,
  ...keys: (keyof S & string)[]
) {
  return (payload: { value: unknown }) => {
    const value = payload.value as Record<string, unknown>;
    return keys.every((key) => {
      const field = schema.shape[key];
      return field !== undefined && z.safeParse(field, value[key]).success;
    });
  };
}
