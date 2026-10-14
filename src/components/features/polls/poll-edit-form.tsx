"use client";

import { CalendarIcon, MapPinIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { InputField, TextareaField } from "@/components/features/forms/form-fields";
import { useActionForm } from "@/components/features/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { pollHref } from "@/lib/routes";
import {
  POLL_DESCRIPTION_MAX_LENGTH,
  POLL_THEME_MAX_LENGTH,
  POLL_TITLE_MAX_LENGTH,
  pollEditSchema,
} from "@/lib/validation/poll";
import { updatePollAction } from "@/server/actions/polls";
import { utcToZonedParts } from "@/server/domain/events/time";
import type { PollView } from "@/server/polls/queries";

import { PollDeadlineField } from "./poll-deadline-field";
import { pollDateLongLabel } from "./poll-labels";
import { placeOptionLabel } from "./vote-form-model";

export type PollEditFormProps = { clubId: string; view: PollView };

/**
 * "Rediger afstemning" (D-133, E24): Titel, Beskrivelse, Tema (valgfrit) and
 * Afstemningsfrist – which can only move later and must stay before the
 * first date (the server decides). The dates and places are shown read-only:
 * options never change after creation; wrong options → cancel and start a
 * new poll. Ballots are kept. Posts to updatePollAction. The page renders the
 * PageHeader and the Card.
 */
export function PollEditForm({ clubId, view }: PollEditFormProps) {
  const { formProps, fieldErrors, formError, values } = useActionForm(updatePollAction, {
    schema: pollEditSchema,
  });
  const stored = utcToZonedParts(view.deadline);
  const [deadline, setDeadline] = useState({
    date: values.deadlineDate ?? stored.date,
    time: values.deadlineTime ?? stored.time,
  });

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
          Datoer og steder kan ikke ændres. Er de forkerte, så annullér afstemningen og start en ny.
        </p>
      </section>

      <PollDeadlineField
        value={deadline}
        onChange={setDeadline}
        hint="Fristen kan kun rykkes senere."
        errors={{ deadlineDate: fieldErrors.deadlineDate, deadlineTime: fieldErrors.deadlineTime }}
      />

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
