import type { z } from "zod";

import { validationError, type FieldErrors } from "@/lib/action-result";

/**
 * Client-side form validation with the same Zod schemas the Server Actions use
 * (src/lib/validation/*), so the inline messages match the server's. Shared by
 * the auth, event and beer forms (useAuthForm, useEventForm, useBeerForm);
 * it still lives under auth/ until TG-021 (a shared useActionForm).
 *
 * Pure and client-safe.
 */

/** The form's text values (files and repeated keys ignored: first value wins). */
export function formDataToValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (typeof value === "string" && !(key in values)) values[key] = value;
  });
  return values;
}

/** Per-field messages when the values fail the schema, or null when they pass. */
export function validateFormData(schema: z.ZodType, formData: FormData): FieldErrors | null {
  const result = schema.safeParse(formDataToValues(formData));
  if (result.success) return null;
  return validationError(result.error).error.fieldErrors ?? {};
}

/** The first field, in form order, that has an error (it gets focus). */
export function firstInvalidField(
  fieldOrder: readonly string[],
  errors: FieldErrors,
): string | null {
  return fieldOrder.find((name) => (errors[name]?.length ?? 0) > 0) ?? null;
}
