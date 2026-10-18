"use client";

import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { InfoIcon } from "lucide-react";

import { InputField, TextareaField } from "@/components/features/forms/form-fields";
import { useActionForm } from "@/components/features/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  FEEDBACK_DESCRIPTION_MAX_LENGTH,
  FEEDBACK_TITLE_MAX_LENGTH,
  feedbackEditSchema,
  feedbackFormSchema,
} from "@/lib/validation/feedback";
import {
  createFeedbackAction,
  updateFeedbackAction,
  type FeedbackFormState,
} from "@/server/actions/feedback";
import { FEEDBACK_PAGE_PATH_MAX_LENGTH } from "@/server/domain/feedback/page-path";
import type { SimilarFeedbackCandidate } from "@/server/domain/feedback/similar";
import { isFeedbackType, type FeedbackType } from "@/server/domain/feedback/status";

import { FEEDBACK_DESCRIPTION_PLACEHOLDERS } from "./feedback-labels";
import { FeedbackTypeChoice } from "./feedback-type-choice";
import { SimilarFeedback } from "./similar-feedback";

export type FeedbackFormProps =
  | {
      mode: "create";
      /** ?type= (BUG unless "feature"). */
      defaultType: FeedbackType;
      /** ?page=, already through toFeedbackPagePath ("" = none). */
      defaultPage: string;
      /** For "Findes den allerede?" (listSimilarCandidates). */
      candidates: readonly SimilarFeedbackCandidate[];
    }
  | {
      mode: "edit";
      feedbackId: string;
      type: FeedbackType;
      defaults: { title: string; description: string };
      /** "Fortryd": back to the report. */
      cancelHref: string;
    };

const subscribeResize = (onChange: () => void) => {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
};

/**
 * "Ny rapport" and "Ret rapport" (SPEC §9.9). Create: the type, Titel with
 * "Findes den allerede?", Beskrivelse (placeholder by type), and for a bug
 * "Side", pre-filled and editable, revealed with CSS so it works before
 * hydration; the screen width goes along in a hidden field (the server reads
 * the browser itself and ignores both for an idea). Edit: Titel and
 * Beskrivelse only.
 *
 * useActionForm: the shared Zod schema in the browser and again in the Server
 * Action; native fields, so it works without JavaScript. Success redirects to
 * the report with a toast.
 */
export function FeedbackForm(props: FeedbackFormProps) {
  const editing = props.mode === "edit";
  const { formProps, fieldErrors, formError, values } = useActionForm<FeedbackFormState>(
    editing ? updateFeedbackAction : createFeedbackAction,
    { schema: editing ? feedbackEditSchema : feedbackFormSchema },
  );
  const echoedType = isFeedbackType(values.type) ? values.type : undefined;
  const startType = editing ? props.type : (echoedType ?? props.defaultType);
  const [type, setType] = useState<FeedbackType>(startType);
  const startTitle = values.title ?? (editing ? props.defaults.title : "");
  const [title, setTitle] = useState(startTitle);
  const width = useSyncExternalStore(
    subscribeResize,
    () => window.innerWidth,
    () => null,
  );

  // A type chosen before hydration: the radios are plain HTML then. Adopt it
  // for the placeholder (the radio itself is uncontrolled and already right).
  const groupRef = useRef<HTMLDivElement>(null);
  const adoptCheckedType = useEffectEvent(() => {
    const checked = groupRef.current?.querySelector<HTMLInputElement>('input[name="type"]:checked');
    if (checked && isFeedbackType(checked.value)) setType(checked.value);
  });
  useEffect(() => {
    const frame = requestAnimationFrame(adoptCheckedType);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <form {...formProps} className="group/feedback grid gap-6">
      {editing ? <input type="hidden" name="feedbackId" value={props.feedbackId} /> : null}
      {formError ? <FormError>{formError.message}</FormError> : null}

      {editing ? null : (
        <div ref={groupRef}>
          <FeedbackTypeChoice
            defaultType={startType}
            onChange={setType}
            errors={fieldErrors.type}
          />
        </div>
      )}

      <div className="grid">
        <InputField
          name="title"
          label="Titel"
          placeholder={type === "BUG" ? "fx Kalenderen viser forkert dato" : "fx Mørkt tema"}
          defaultValue={startTitle}
          maxLength={FEEDBACK_TITLE_MAX_LENGTH}
          autoComplete="off"
          required
          errors={fieldErrors.title}
          onChange={(event) => setTitle(event.currentTarget.value)}
        />
        {editing ? null : <SimilarFeedback title={title} candidates={props.candidates} />}
      </div>

      <TextareaField
        name="description"
        label="Beskrivelse"
        placeholder={FEEDBACK_DESCRIPTION_PLACEHOLDERS[type]}
        defaultValue={values.description ?? (editing ? props.defaults.description : "")}
        maxLength={FEEDBACK_DESCRIPTION_MAX_LENGTH}
        rows={6}
        required
        errors={fieldErrors.description}
      />

      {editing ? null : (
        <>
          {/* Only for a bug, shown with CSS (works before hydration, D-111). */}
          <div className="hidden group-has-[.feedback-type-bug:checked]/feedback:grid">
            <InputField
              name="pagePath"
              label="Side (udfyldt automatisk, kan rettes)"
              placeholder="fx /calendar"
              defaultValue={values.pagePath ?? props.defaultPage}
              maxLength={FEEDBACK_PAGE_PATH_MAX_LENGTH}
              autoComplete="off"
              spellCheck={false}
              errors={fieldErrors.pagePath}
            />
          </div>
          <input type="hidden" name="viewportWidth" value={width ?? ""} />
          <p className="flex items-start gap-2 text-[0.95rem] text-muted-foreground">
            <InfoIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-harbor" />
            Din rapport kan ses af alle brugere af appen.
          </p>
        </>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SubmitButton size="lg" pendingLabel={editing ? "Gemmer …" : "Sender …"}>
          {editing ? "Gem" : "Send"}
        </SubmitButton>
        {editing ? (
          <Button asChild variant="ghost" size="lg">
            <Link href={props.cancelHref}>Fortryd</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
