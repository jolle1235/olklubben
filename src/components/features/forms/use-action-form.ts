"use client";

import { useActionState, useEffect, useRef, useState, type RefObject } from "react";
import type { z } from "zod";

import { ACTION_ERROR_CODES, type ActionError, type FieldErrors } from "@/lib/action-result";
import type { FormValues } from "@/lib/form-data";

import { focusFirstInvalid, validateFormData } from "./form-validation";

/** What a failed state may echo back: any of the form's values (never passwords). */
type EchoedValues = { readonly [field: string]: string | readonly string[] | undefined };

/**
 * The state shape every form action shares (SPEC §4.3): null before the
 * first submit, a failure with the typed values echoed back, or a success
 * that stays on the page (most successes redirect instead).
 */
export type ActionFormState =
  { ok: false; error: ActionError; values?: EchoedValues } | { ok: true; data?: unknown } | null;

type EchoOf<S> = S extends { ok: false; values?: infer V } ? (V extends object ? V : never) : never;

/** The echo's type: the action's own values type, or any form values. */
export type ActionFormValues<S> = [EchoOf<S>] extends [never]
  ? Partial<FormValues>
  : Partial<EchoOf<S>>;

export type UseActionFormOptions = {
  /** The Server Action's own Zod schema (src/lib/validation/*). */
  schema: z.ZodType;
  /** Fields that may repeat (checkbox lists), read as lists. */
  arrayFields?: readonly string[];
};

/**
 * One form engine for every Server Action form (TG-021, D-056): the action
 * through useActionState, so the form also works without JavaScript, plus
 * browser validation with the same Zod schema.
 *
 *   * Invalid on submit: the submit is cancelled (React then skips the
 *     action), the messages show inline and the first invalid field gets
 *     focus.
 *   * After that, every change re-validates, so a message disappears as soon
 *     as the field is fixed ({} also keeps stale server errors hidden).
 *   * Otherwise the server's answer: `fieldErrors` inline, and focus moves to
 *     the first one (also after a no-JS submit, and again for the same error
 *     twice, since every submit gives a new state object). Anything but a
 *     validation error is `formError`. Redirects need no handling (F-030).
 *
 * Spread `formProps` on the <form>. `values` is what was typed before a
 * failed server submit: use it as the fields' defaultValue, because React
 * resets an uncontrolled form after the action.
 */
export function useActionForm<S extends ActionFormState>(
  // F-021: React types the state as Awaited<S>.
  action: (state: Awaited<S>, formData: FormData) => Promise<S>,
  { schema, arrayFields }: UseActionFormOptions,
) {
  const [state, formAction, pending] = useActionState(action, null as Awaited<S>);
  // null: the browser has nothing to say (never validated, or the last submit passed).
  const [clientErrors, setClientErrors] = useState<FieldErrors | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const registered = useRef(new Map<string, HTMLElement>());

  const failed = failureOf(state);

  // Field errors from the server move focus too. Keyed on `state`: the same
  // error twice is a new object, so it focuses again.
  useEffect(() => {
    const errors = failureOf(state)?.error.fieldErrors;
    if (errors && formRef.current) focusFirstInvalid(formRef.current, errors, registered.current);
  }, [state]);

  function validate(formData: FormData): FieldErrors | null {
    return validateFormData(schema, formData, { arrays: arrayFields });
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const errors = validate(new FormData(form));
    setClientErrors(errors);
    if (!errors) return;
    event.preventDefault();
    focusFirstInvalid(form, errors, registered.current);
  }

  /** Re-validates once the browser has shown errors. Controlled widgets pass their values. */
  function revalidate(input?: FormData) {
    if (clientErrors === null) return;
    const formData = input ?? (formRef.current ? new FormData(formRef.current) : null);
    if (formData) setClientErrors(validate(formData) ?? {});
  }

  function onChange(event: React.FormEvent<HTMLFormElement>) {
    revalidate(new FormData(event.currentTarget));
  }

  /** A ref for a field that is not a plain named control (or needs a specific element focused). */
  function register(field: string) {
    return (element: HTMLElement | null) => {
      if (element) registered.current.set(field, element);
      else registered.current.delete(field);
    };
  }

  // The server's answer, unless the browser has its own or a new submit is underway.
  const serverError = !pending && clientErrors === null ? (failed?.error ?? null) : null;

  return {
    state,
    pending,
    formProps: {
      ref: formRef satisfies RefObject<HTMLFormElement | null>,
      action: formAction,
      onSubmit,
      onChange,
      noValidate: true as const,
    },
    /** The browser's messages, else the server's. */
    fieldErrors: clientErrors ?? serverError?.fieldErrors ?? ({} as FieldErrors),
    /**
     * A server error that is not about the fields (rate limited, forbidden,
     * unexpected …). An error that carries fieldErrors is shown on the fields
     * only, whatever its code (fx a wrong current password), never twice.
     */
    formError:
      serverError?.code === ACTION_ERROR_CODES.VALIDATION || serverError?.fieldErrors
        ? null
        : serverError,
    /** The server's error as currently shown, validation included (fx a code to branch on). */
    serverError,
    values: (failed?.values ?? {}) as ActionFormValues<Awaited<S>>,
    register,
    revalidate,
  };
}

function failureOf(state: unknown): Extract<ActionFormState, { ok: false }> | null {
  const result = state as ActionFormState;
  return result !== null && !result.ok ? result : null;
}
