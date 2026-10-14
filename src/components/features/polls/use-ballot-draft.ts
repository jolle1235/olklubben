"use client";

import { useEffect, useEffectEvent, useState, type RefObject } from "react";

import type { BallotDraft } from "./ballot-preview";

/** The draft as the form fields would send it (for re-validation before React re-renders). */
function draftFormData(form: HTMLFormElement, draft: BallotDraft): FormData {
  const formData = new FormData(form);
  formData.delete("dateOptionIds");
  for (const id of draft.dateOptionIds) formData.append("dateOptionIds", id);
  if (draft.noDateWorks) formData.set("noDateWorks", "on");
  else formData.delete("noDateWorks");
  if (draft.placeOptionId) formData.set("placeOptionId", draft.placeOptionId);
  else formData.delete("placeOptionId");
  return formData;
}

/**
 * The vote form's draft ballot (controlled checkboxes and radios): starts as
 * the saved ballot, adopts ticks made before hydration (TG-037), and
 * re-validates with every change once the browser has shown errors.
 */
export function useBallotDraft(input: {
  formRef: RefObject<HTMLFormElement | null>;
  /** useActionForm's revalidate: a no-op until the browser has shown errors. */
  revalidate: (formData?: FormData) => void;
  saved: BallotDraft;
}) {
  const { formRef, revalidate } = input;
  const [draft, setDraft] = useState<BallotDraft>(input.saved);

  // Before hydration the inputs are plain HTML; React keeps the server-rendered
  // state in defaultChecked. Adopt what was ticked then, or React's next render
  // would quietly undo it.
  const adoptPreHydrationTicks = useEffectEvent(() => {
    const form = formRef.current;
    if (!form) return;
    const inputs = (name: string) => [
      ...form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`),
    ];
    const changed = ["dateOptionIds", "noDateWorks", "placeOptionId"].some((name) =>
      inputs(name).some((element) => element.checked !== element.defaultChecked),
    );
    if (!changed) return;
    setDraft({
      dateOptionIds: inputs("dateOptionIds")
        .filter((element) => element.checked)
        .map((element) => element.value),
      noDateWorks: inputs("noDateWorks").some((element) => element.checked),
      placeOptionId: inputs("placeOptionId").find((element) => element.checked)?.value ?? null,
    });
  });
  useEffect(() => {
    // The DOM is the external source here; read it once, right after hydration.
    const frame = requestAnimationFrame(adoptPreHydrationTicks);
    return () => cancelAnimationFrame(frame);
  }, []);

  return {
    draft,
    update(next: BallotDraft) {
      setDraft(next);
      const form = formRef.current;
      if (form) revalidate(draftFormData(form, next));
    },
  };
}
