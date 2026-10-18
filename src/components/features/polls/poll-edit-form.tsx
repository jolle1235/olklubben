"use client";

import { CalendarIcon, MapPinIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { InputField, TextareaField } from "@/components/features/forms/form-fields";
import { useActionForm } from "@/components/features/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FieldErrors } from "@/lib/action-result";
import { pollHref } from "@/lib/routes";
import {
  POLL_ARRAY_FIELDS,
  POLL_DESCRIPTION_MAX_LENGTH,
  POLL_THEME_MAX_LENGTH,
  POLL_TITLE_MAX_LENGTH,
  pollEditSchema,
} from "@/lib/validation/poll";
import { updatePollAction, type PollEditFormValues } from "@/server/actions/polls";
import { utcToZonedParts, type DateKey } from "@/server/domain/events/time";
import type { PlaceOption } from "@/server/places/queries";
import type { PollView } from "@/server/polls/queries";

import { PollDeadlineField } from "./poll-deadline-field";
import { PollEditPlan } from "./poll-edit-plan";
import { pollDateLongLabel } from "./poll-labels";
import { placeOptionLabel } from "./vote-form-model";

export type PollEditFormProps = {
  clubId: string;
  view: PollView;
  /** listPlaceOptions(clubId) while nobody has voted; [] once somebody has. */
  places: PlaceOption[];
  /** Today in Copenhagen: the date pickers' minimum. */
  today: DateKey;
};

/**
 * "Rediger afstemning" (D-133, D-153, E24): Titel, Beskrivelse, Tema
 * (valgfrit), then
 *   * while nobody has voted (view.ballotCount === 0, former members'
 *     ballots included): the dates, start time and places as on create
 *     (PollEditPlan) and the deadline;
 *   * once somebody has: the dates and places read-only and a deadline that
 *     can only move later (E24).
 * Posts to updatePollAction, which decides under the poll lock. If a ballot
 * arrives while the plan is open, the action answers with a form error and the
 * page re-renders read-only. Ballots are kept. The page renders the PageHeader
 * and the Card.
 */
export function PollEditForm({ clubId, view, places, today }: PollEditFormProps) {
  const { state, formProps, fieldErrors, formError, values, revalidate } = useActionForm(
    updatePollAction,
    { schema: pollEditSchema, arrayFields: POLL_ARRAY_FIELDS },
  );

  return (
    <form {...formProps} className="grid gap-7">
      <input type="hidden" name="clubId" value={clubId} />
      <input type="hidden" name="pollId" value={view.id} />

      {formError ? <FormError>{formError.message}</FormError> : null}

      <InputField
        name="title"
        label="Titel"
        defaultValue={values.title ?? view.title}
        maxLength={POLL_TITLE_MAX_LENGTH}
        autoComplete="off"
        required
        errors={fieldErrors.title}
      />

      <TextareaField
        name="description"
        label="Beskrivelse"
        optional="valgfri"
        defaultValue={values.description ?? view.description ?? ""}
        maxLength={POLL_DESCRIPTION_MAX_LENGTH}
        rows={4}
        errors={fieldErrors.description}
      />

      <InputField
        name="theme"
        label="Tema"
        optional="valgfrit"
        placeholder="fx Juleøl"
        defaultValue={values.theme ?? view.theme ?? ""}
        maxLength={POLL_THEME_MAX_LENGTH}
        autoComplete="off"
        errors={fieldErrors.theme}
      />

      {view.ballotCount === 0 ? (
        <PollEditPlan
          clubId={clubId}
          view={view}
          places={places}
          today={today}
          formRef={formProps.ref}
          revalidate={revalidate}
          echo={values}
          errors={fieldErrors}
          resetSignal={state}
        />
      ) : (
        <FrozenPollPlan view={view} echo={values} errors={fieldErrors} />
      )}

      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
        <SubmitButton size="lg" pendingLabel="Gemmer …">
          Gem ændringer
        </SubmitButton>
        <Button asChild variant="ghost" size="lg">
          <Link href={pollHref(clubId, view.id)}>Annuller</Link>
        </Button>
      </div>
    </form>
  );
}

/**
 * Once somebody has voted (D-153): the dates and places as a list – wrong
 * options mean cancelling and starting a new poll – and the deadline, which
 * the server only lets move later (E24).
 */
function FrozenPollPlan({
  view,
  echo,
  errors,
}: {
  view: PollView;
  echo: Partial<PollEditFormValues>;
  errors: FieldErrors;
}) {
  const stored = utcToZonedParts(view.deadline);
  const [deadline, setDeadline] = useState({
    date: echo.deadlineDate ?? stored.date,
    time: echo.deadlineTime ?? stored.time,
  });

  return (
    <>
      <section
        aria-labelledby="poll-edit-options-heading"
        className="grid grid-cols-1 gap-3 rounded-xl border-2 border-dashed border-harbor/40 bg-harbor-tint/40 px-4 py-4"
      >
        <h2 id="poll-edit-options-heading" className="text-[0.95rem] font-semibold text-ink">
          Datoer og steder
        </h2>
        <ul className="grid grid-cols-1 gap-1.5">
          {view.dates.map((option) => (
            <li key={option.id} className="flex min-w-0 items-start gap-2 text-ink">
              <CalendarIcon aria-hidden className="mt-1 size-4 shrink-0 text-harbor" />
              <span className="min-w-0 break-words first-letter:uppercase">
                {pollDateLongLabel(option.startsAt)}
              </span>
            </li>
          ))}
          {view.places.map((option) => (
            <li key={option.id} className="flex min-w-0 items-start gap-2 text-ink">
              <MapPinIcon aria-hidden className="mt-1 size-4 shrink-0 text-harbor" />
              <span className="min-w-0 break-words hyphens-auto">
                {placeOptionLabel(option.place)}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-[0.95rem] text-slate">
          Datoer og steder kan ikke ændres, når nogen har stemt. Er de forkerte, så annullér
          afstemningen og start en ny.
        </p>
      </section>

      <PollDeadlineField
        value={deadline}
        onChange={setDeadline}
        hint="Fristen kan kun rykkes senere."
        errors={{ deadlineDate: errors.deadlineDate, deadlineTime: errors.deadlineTime }}
      />
    </>
  );
}
