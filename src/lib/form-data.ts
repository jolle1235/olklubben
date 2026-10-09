/**
 * Reads a submitted form into plain values for the shared Zod schemas
 * (src/lib/validation/*). Used by the forms in the browser
 * (src/components/features/forms) and by the Server Actions, so both parse
 * exactly the same input.
 *
 * Pure and client-safe.
 */

/** A form's text values: one string per field, or a list for repeated fields (fx hostIds). */
export type FormValues = Record<string, string | string[]>;

export type ReadFormValuesOptions = {
  /** Fields that may repeat (checkbox lists). Always a list, [] when missing. */
  arrays?: readonly string[];
  /**
   * The schema's own maximum for a list. One more item is kept, so the
   * schema's `.max` still fails, but a forged request cannot grow the list.
   */
  maxArrayLength?: number;
  /** Never read, fx passwords that must not be echoed back to the form. */
  exclude?: readonly string[];
};

export const DEFAULT_MAX_ARRAY_LENGTH = 50;

/**
 * The form's text values. Files are ignored. A scalar field keeps its first
 * value (a repeated key cannot smuggle in a second one); an array field keeps
 * every value, at most `maxArrayLength + 1`.
 */
export function readFormValues(
  formData: FormData,
  {
    arrays = [],
    maxArrayLength = DEFAULT_MAX_ARRAY_LENGTH,
    exclude = [],
  }: ReadFormValuesOptions = {},
): FormValues {
  const excluded = new Set(exclude);
  const arrayFields = new Set(arrays.filter((field) => !excluded.has(field)));
  // A Map, so names like "constructor" or "__proto__" are ordinary keys.
  const values = new Map<string, string | string[]>();
  for (const field of arrayFields) values.set(field, []);

  formData.forEach((value, key) => {
    if (typeof value !== "string" || excluded.has(key)) return;
    if (arrayFields.has(key)) {
      const list = values.get(key) as string[];
      if (list.length <= maxArrayLength) list.push(value);
    } else if (!values.has(key)) {
      values.set(key, value);
    }
  });

  return Object.fromEntries(values);
}
