import { z } from "zod";

import { isValidId } from "@/lib/ids";
import { stripNul } from "@/lib/text";

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
