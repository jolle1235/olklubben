"use client";

import { useEffectEvent, useLayoutEffect, useRef, useState } from "react";

import { FieldShell, TextareaField } from "@/components/features/forms/form-fields";
import { useActionForm } from "@/components/features/forms/use-action-form";
import { FormError } from "@/components/ui/form-message";
import { NativeSelect } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  FEEDBACK_ADMIN_RESPONSE_MAX_LENGTH,
  feedbackModerationSchema,
} from "@/lib/validation/feedback";
import { moderateFeedbackAction, type FeedbackModerationState } from "@/server/actions/feedback";
import {
  FEEDBACK_STATUSES,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_TYPE_ICONS,
  type FeedbackStatus,
} from "@/server/domain/feedback/status";
import type { DuplicateTarget } from "@/server/feedback/queries";

export type FeedbackModerationFormProps = {
  feedbackId: string;
  status: FeedbackStatus;
  adminResponse: string | null;
  duplicateOfId: string | null;
  /** The reports this one can be a duplicate of (listDuplicateTargets). */
  targets: readonly DuplicateTarget[];
};

/** Postgres counts characters, not UTF-16 units (F-077). */
const characterCount = (text: string) => [...text].length;

/**
 * Status, answer and "Dublet af …" for app-admins (SPEC §9.9 "Detaljeside",
 * E28): Status (6 Danish labels), "Svar (vises for alle)" with a counter, and
 * "Original rapport", shown only while Dublet is chosen. Afvist hints at a
 * reason. Both reveals are CSS (`option:checked` under `group-has`), so they
 * follow the select before hydration and without React state.
 *
 * The selects are uncontrolled; React 19's form.reset() after a server answer
 * would put them back to the first render's choice, so a layout effect sets
 * the echoed choice again (F-053, D-113). Success redirects with "Status er
 * gemt ✓".
 */
export function FeedbackModerationForm({
  feedbackId,
  status,
  adminResponse,
  duplicateOfId,
  targets,
}: FeedbackModerationFormProps) {
  const { state, formProps, fieldErrors, formError, values } =
    useActionForm<FeedbackModerationState>(moderateFeedbackAction, {
      schema: feedbackModerationSchema,
    });
  const chosenStatus = values.status ?? status;
  const chosenOriginal = values.duplicateOfId ?? duplicateOfId ?? "";
  const startResponse = values.adminResponse ?? adminResponse ?? "";
  const [responseLength, setResponseLength] = useState(characterCount(startResponse));

  // F-053/D-113: put the echoed choices back right after React's form.reset()
  // (same commit, before paint). Only when the action state changed.
  const restoreChoices = useEffectEvent(() => {
    const form = formProps.ref.current;
    const statusSelect = form?.elements.namedItem("status");
    const originalSelect = form?.elements.namedItem("duplicateOfId");
    if (statusSelect instanceof HTMLSelectElement) statusSelect.value = chosenStatus;
    if (originalSelect instanceof HTMLSelectElement) originalSelect.value = chosenOriginal;
  });
  const seenState = useRef(state);
  useLayoutEffect(() => {
    if (seenState.current === state) return;
    seenState.current = state;
    restoreChoices();
  }, [state]);

  return (
    <form {...formProps} className="group/moderation grid gap-5">
      <input type="hidden" name="feedbackId" value={feedbackId} />
      {formError ? <FormError>{formError.message}</FormError> : null}

      <FieldShell label="Status" errors={fieldErrors.status}>
        {(control) => (
          <NativeSelect {...control} name="status" defaultValue={chosenStatus}>
            {FEEDBACK_STATUSES.map((option) => (
              <option
                key={option}
                value={option}
                className={
                  option === "DUPLICATE"
                    ? "status-duplicate"
                    : option === "WONT_DO"
                      ? "status-wont-do"
                      : undefined
                }
              >
                {FEEDBACK_STATUS_LABELS[option]}
              </option>
            ))}
          </NativeSelect>
        )}
      </FieldShell>
      <p className="-mt-3 hidden text-[0.95rem] text-muted-foreground group-has-[.status-wont-do:checked]/moderation:block">
        Skriv gerne en begrundelse.
      </p>

      <FieldShell
        label="Original rapport"
        errors={fieldErrors.duplicateOfId}
        className="hidden group-has-[.status-duplicate:checked]/moderation:grid"
      >
        {(control) => (
          <NativeSelect {...control} name="duplicateOfId" defaultValue={chosenOriginal}>
            <option value="">Vælg den originale rapport …</option>
            {targets.map((target) => (
              <option key={target.id} value={target.id}>
                {FEEDBACK_TYPE_ICONS[target.type]} {target.title}
              </option>
            ))}
          </NativeSelect>
        )}
      </FieldShell>

      <TextareaField
        name="adminResponse"
        label="Svar (vises for alle)"
        optional="valgfrit"
        defaultValue={startResponse}
        maxLength={FEEDBACK_ADMIN_RESPONSE_MAX_LENGTH}
        rows={4}
        placeholder="fx Rettet i version fra 12/10"
        hint={`${responseLength} / ${FEEDBACK_ADMIN_RESPONSE_MAX_LENGTH} tegn`}
        errors={fieldErrors.adminResponse}
        onInput={(event) => setResponseLength(characterCount(event.currentTarget.value))}
      />

      <SubmitButton className="w-full sm:w-fit" pendingLabel="Gemmer …">
        Gem
      </SubmitButton>
    </form>
  );
}
