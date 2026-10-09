import type { z } from "zod";

import { validationError, type FieldErrors } from "@/lib/action-result";
import { readFormValues } from "@/lib/form-data";

/**
 * Client-side form validation with the same Zod schemas the Server Actions
 * use (src/lib/validation/*), so the inline messages match the server's, and
 * focus on the first invalid field (SPEC §15.2, D-056). Used by
 * useActionForm.
 *
 * The decisions are pure helpers (unit-tested); focusFirstInvalid applies
 * them to the DOM. Client-safe.
 */

/** Per-field messages when the values fail the schema, or null when they pass. */
export function validateFormData(
  schema: z.ZodType,
  formData: FormData,
  { arrays }: { arrays?: readonly string[] } = {},
): FieldErrors | null {
  const result = schema.safeParse(readFormValues(formData, { arrays }));
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

/**
 * The form's field names in DOM order, each once (radio groups and checkbox
 * lists share a name), then any registered field the form does not name.
 */
export function fieldOrderOf(
  names: Iterable<string | null>,
  registered: Iterable<string> = [],
): string[] {
  const order = new Set<string>();
  for (const name of names) if (name) order.add(name);
  for (const name of registered) order.add(name);
  return [...order];
}

/** The part of a form control the focus rule needs. */
export type GroupControl = { type: string; checked: boolean };

/**
 * Which control of a group sharing one name gets focus: the checked radio
 * (where the arrow keys continue), else the first visible control. -1 when
 * none can take focus.
 */
export function focusIndexInGroup(controls: readonly GroupControl[]): number {
  const checkedRadio = controls.findIndex((control) => control.type === "radio" && control.checked);
  if (checkedRadio !== -1) return checkedRadio;
  return controls.findIndex((control) => control.type !== "hidden");
}

function controlOf(item: Element | RadioNodeList | null): HTMLElement | null {
  // Not `"length" in item`: a <select> has a length too.
  if (!(item instanceof RadioNodeList)) return item instanceof HTMLElement ? item : null;
  // Several controls share the name (radio cards, checkbox chips).
  const controls = Array.from(item);
  const index = focusIndexInGroup(
    controls.map((control) => ({
      type: control instanceof HTMLInputElement ? control.type : "",
      checked: control instanceof HTMLInputElement && control.checked,
    })),
  );
  const control = controls[index];
  return control instanceof HTMLElement ? control : null;
}

/**
 * Moves focus to the first invalid field in DOM order (D-056): a registered
 * element first (controlled widgets, fx the beer form), else the form's
 * control of that name.
 */
export function focusFirstInvalid(
  form: HTMLFormElement,
  errors: FieldErrors,
  registered?: ReadonlyMap<string, HTMLElement>,
): void {
  const names = Array.from(form.elements, (element) => element.getAttribute("name"));
  const first = firstInvalidField(fieldOrderOf(names, registered?.keys()), errors);
  if (!first) return;
  const element = registered?.get(first) ?? controlOf(form.elements.namedItem(first));
  element?.focus();
}
