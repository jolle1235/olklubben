"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { firstInvalidField, validateFormData } from "@/components/features/auth/form-validation";
import { ACTION_ERROR_CODES, type FieldErrors } from "@/lib/action-result";
import { eventFormSchema } from "@/lib/validation/event";
import type { EventFormState } from "@/server/actions/events";

type EventFormAction = (state: EventFormState, formData: FormData) => Promise<EventFormState>;

function focusFirstInvalid(form: HTMLFormElement, errors: FieldErrors) {
  const order = Array.from(form.elements, (element) => element.getAttribute("name") ?? "");
  const first = firstInvalidField(order, errors);
  const field = first ? form.elements.namedItem(first) : null;
  if (field instanceof HTMLElement) field.focus();
}

/**
 * The event form's state, like useAuthForm (src/components/features/auth):
 * the Server Action via useActionState (so the form works without
 * JavaScript) plus browser validation with the same Zod schema.
 *
 *   * Invalid on submit: the submit is cancelled, the messages show inline and
 *     the first invalid field gets focus (D-056).
 *   * After that, every change re-validates, so a message disappears as soon
 *     as the field is fixed.
 *   * Otherwise the server's answer: `fieldErrors` inline (focus moves too),
 *     anything else as a form error. Success redirects.
 *
 * `values` is what was typed before a failed server submit: use it as the
 * fields' defaultValue, because React resets the form after the action.
 */
export function useEventForm(action: EventFormAction) {
  const [state, formAction, pending] = useActionState(action, null);
  // null: the browser has nothing to say (never validated, or the last submit passed).
  const [clientErrors, setClientErrors] = useState<FieldErrors | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Field errors from the server (e.g. a submit before hydration) also move focus.
  useEffect(() => {
    const errors = state?.error.fieldErrors;
    if (errors && formRef.current) focusFirstInvalid(formRef.current, errors);
  }, [state]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const errors = validateFormData(eventFormSchema, new FormData(form));
    setClientErrors(errors);
    if (!errors) return;
    event.preventDefault();
    focusFirstInvalid(form, errors);
  }

  function onChange(event: React.FormEvent<HTMLFormElement>) {
    if (clientErrors === null) return;
    // {} rather than null: the fields are fine now, and stale server errors stay hidden.
    setClientErrors(validateFormData(eventFormSchema, new FormData(event.currentTarget)) ?? {});
  }

  const serverError = !pending && clientErrors === null ? (state?.error ?? null) : null;

  return {
    formProps: { ref: formRef, action: formAction, onSubmit, onChange, noValidate: true },
    fieldErrors: clientErrors ?? serverError?.fieldErrors ?? {},
    formError: serverError?.code === ACTION_ERROR_CODES.VALIDATION ? null : serverError,
    values: state?.values ?? {},
    pending,
  };
}
