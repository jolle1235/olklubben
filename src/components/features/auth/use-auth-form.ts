"use client";

import { useActionState, useState } from "react";
import type { z } from "zod";

import { ACTION_ERROR_CODES, type ActionError, type FieldErrors } from "@/lib/action-result";
import type { AuthFormValues } from "@/server/actions/auth";

import { firstInvalidField, validateFormData } from "./form-validation";

type FailedState = { ok: false; error: ActionError; values: AuthFormValues };
type AnyAuthState = FailedState | { ok: true } | null;

/**
 * One auth form: the Server Action (useActionState, so it also works without
 * JavaScript) plus browser validation with the same Zod schema.
 *
 *   * Invalid on submit: the submit is cancelled (React then skips the form
 *     action), the messages show inline and the first invalid field gets focus.
 *   * After that, every change re-validates, so a message disappears as soon
 *     as the field is fixed.
 *   * Otherwise the server's answer is shown: `fieldErrors` inline,
 *     `formError` (anything but a validation error) as an alert.
 *
 * Spread `formProps` on the <form>.
 */
export function useAuthForm<S extends AnyAuthState>(
  action: (state: Awaited<S>, formData: FormData) => Promise<S>,
  schema: z.ZodType,
) {
  const [state, formAction, pending] = useActionState(action, null as Awaited<S>);
  // null: the browser has nothing to say (never validated, or the last submit passed).
  const [clientErrors, setClientErrors] = useState<FieldErrors | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const errors = validateFormData(schema, new FormData(form));
    setClientErrors(errors);
    if (!errors) return;

    event.preventDefault();
    const order = Array.from(form.elements, (element) => element.getAttribute("name") ?? "");
    const first = firstInvalidField(order, errors);
    const field = first ? form.elements.namedItem(first) : null;
    if (field instanceof HTMLElement) field.focus();
  }

  function onChange(event: React.FormEvent<HTMLFormElement>) {
    if (clientErrors === null) return;
    // {} rather than null: the fields are fine now, and stale server errors stay hidden.
    setClientErrors(validateFormData(schema, new FormData(event.currentTarget)) ?? {});
  }

  const result = state as AnyAuthState;
  const failed = result !== null && !result.ok ? result : null;
  const serverError = !pending && clientErrors === null ? (failed?.error ?? null) : null;

  return {
    state,
    formProps: { action: formAction, onSubmit, onChange, noValidate: true },
    fieldErrors: clientErrors ?? serverError?.fieldErrors ?? {},
    formError: serverError?.code === ACTION_ERROR_CODES.VALIDATION ? null : serverError,
    /** What was typed before a failed submit (never passwords). */
    values: failed?.values ?? {},
  };
}
