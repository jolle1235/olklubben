"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { firstInvalidField, validateFormData } from "@/components/features/auth/form-validation";
import { ACTION_ERROR_CODES, type FieldErrors } from "@/lib/action-result";
import { beerFormSchema } from "@/lib/validation/beer";
import { createBeerAction, updateBeerAction, type BeerFormState } from "@/server/actions/beers";
import { beerDuplicateKey, findSameNameBeers } from "@/server/domain/beers/name";

import { mergeBeersById, type BeerNameEntry } from "./catalog-view";

const FIELD_ORDER = ["name", "abv", "eventId"] as const;
type FieldName = (typeof FIELD_ORDER)[number];

export type BeerFormDefaults = { name: string; abv: string; eventId: string };

export type UseBeerFormOptions = {
  mode: "create" | "edit";
  defaults: BeerFormDefaults;
  /** The club's other beers, for the live duplicate warning. */
  existingBeers: BeerNameEntry[];
};

/**
 * State for <BeerForm />: the Server Action through useActionState (so the
 * form also works without JavaScript), browser validation with the same Zod
 * schema, focus on the first invalid field (D-056), and the duplicate warning
 * (E21) – live while typing, and from the server on submit.
 *
 * The fields are controlled, so what was typed survives a failed submit; the
 * first render after a no-JS submit starts from the echoed values.
 */
export function useBeerForm({ mode, defaults, existingBeers }: UseBeerFormOptions) {
  const action = mode === "create" ? createBeerAction : updateBeerAction;
  const [state, formAction, pending] = useActionState<BeerFormState, FormData>(action, null);
  const [values, setValues] = useState<BeerFormDefaults>(() => ({
    name: state?.values.name ?? defaults.name,
    abv: state?.values.abv ?? defaults.abv,
    eventId: state?.values.eventId ?? defaults.eventId,
  }));
  // null: the browser has nothing to say (never validated, or the last submit passed).
  const [clientErrors, setClientErrors] = useState<FieldErrors | null>(null);
  const fields = useRef(new Map<FieldName, HTMLElement>());

  const serverError = !pending && clientErrors === null ? (state?.error ?? null) : null;
  const fieldErrors: FieldErrors = clientErrors ?? serverError?.fieldErrors ?? {};
  const formError =
    serverError && serverError.code !== ACTION_ERROR_CODES.VALIDATION && !state?.duplicates?.length
      ? serverError.message
      : null;

  // Live: a changed name that another beer of the club already has. Server:
  // the beers it found for the name that was submitted (if still typed).
  const nameKey = beerDuplicateKey(values.name);
  const nameChanged = mode === "create" || nameKey !== beerDuplicateKey(defaults.name);
  const live = nameChanged ? findSameNameBeers(existingBeers, values.name) : [];
  const fromServer =
    state?.duplicates && beerDuplicateKey(state.values.name ?? "") === nameKey
      ? state.duplicates
      : [];
  const duplicates = mergeBeersById(live, fromServer);

  // A server-side field error moves focus to the field (SPEC §15.2). `state`
  // is a new object per submit, so the same error twice focuses it again.
  useEffect(() => {
    const errors = state?.error.fieldErrors;
    if (!errors) return;
    const first = firstInvalidField(FIELD_ORDER, errors) as FieldName | null;
    if (first) fields.current.get(first)?.focus();
  }, [state]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const errors = validateFormData(beerFormSchema, new FormData(event.currentTarget));
    setClientErrors(errors);
    if (!errors) return;
    event.preventDefault();
    const first = firstInvalidField(FIELD_ORDER, errors) as FieldName | null;
    if (first) fields.current.get(first)?.focus();
  }

  function setValue(field: FieldName, value: string) {
    const next = { ...values, [field]: value };
    setValues(next);
    if (clientErrors === null) return;
    // {} rather than null: the fields are fine now, and stale server errors stay hidden.
    setClientErrors(validateFormData(beerFormSchema, toFormData(next)) ?? {});
  }

  function register(field: FieldName) {
    return (element: HTMLElement | null) => {
      if (element) fields.current.set(field, element);
      else fields.current.delete(field);
    };
  }

  return {
    formProps: { action: formAction, onSubmit, noValidate: true },
    pending,
    values,
    setValue,
    register,
    fieldErrors,
    formError,
    duplicates,
  };
}

function toFormData(values: BeerFormDefaults): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}
