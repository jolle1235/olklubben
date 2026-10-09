"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { useActionForm } from "@/components/features/forms/use-action-form";
import { beerFormSchema } from "@/lib/validation/beer";
import { createBeerAction, updateBeerAction } from "@/server/actions/beers";
import { beerDuplicateKey, findSameNameBeers } from "@/server/domain/beers/name";

import { mergeBeersById, type BeerNameEntry } from "./catalog-view";

type FieldName = "name" | "abv" | "eventId";

export type BeerFormDefaults = { name: string; abv: string; eventId: string };

export type UseBeerFormOptions = {
  mode: "create" | "edit";
  defaults: BeerFormDefaults;
  /** The club's other beers, for the live duplicate warning. */
  existingBeers: BeerNameEntry[];
};

/**
 * State for <BeerForm />: useActionForm (the Server Action through
 * useActionState, so the form also works without JavaScript, browser
 * validation with the same Zod schema, focus on the first invalid field,
 * D-056) plus the duplicate warning (E21) – live while typing, and from the
 * server on submit.
 *
 * The fields are controlled, so what was typed survives a failed submit; the
 * first render after a no-JS submit starts from the echoed values. They
 * re-validate through setValue, so the form itself needs no onChange.
 */
export function useBeerForm({ mode, defaults, existingBeers }: UseBeerFormOptions) {
  const form = useActionForm(mode === "create" ? createBeerAction : updateBeerAction, {
    schema: beerFormSchema,
  });
  const { state } = form;
  const [values, setValues] = useState<BeerFormDefaults>(() => ({
    name: state?.values.name ?? defaults.name,
    abv: state?.values.abv ?? defaults.abv,
    eventId: state?.values.eventId ?? defaults.eventId,
  }));

  // The duplicate warning explains a DUPLICATE_BEER answer by itself.
  const formError = form.formError && !state?.duplicates?.length ? form.formError.message : null;

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

  function setValue(field: FieldName, value: string) {
    const next = { ...values, [field]: value };
    setValues(next);
    form.revalidate(toFormData(next));
  }

  const { ref, action, onSubmit, noValidate } = form.formProps;

  // F-053: after a server answer React 19 resets the form, and the controlled
  // event <select> falls back to its first option ("Intet event") while the
  // state keeps the choice, so "Tilføj alligevel" would save the beer without
  // its event. Put the choice back in the same commit, before paint. Only when
  // the action state changed, never on mount.
  const seenState = useRef(state);
  useLayoutEffect(() => {
    if (seenState.current === state) return;
    seenState.current = state;
    const select = ref.current?.elements.namedItem("eventId");
    if (select instanceof HTMLSelectElement) select.value = values.eventId;
  }, [ref, state, values.eventId]);

  return {
    formProps: { ref, action, onSubmit, noValidate },
    pending: form.pending,
    values,
    setValue,
    register: (field: FieldName) => form.register(field),
    fieldErrors: form.fieldErrors,
    formError,
    duplicates,
  };
}

function toFormData(values: BeerFormDefaults): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}
