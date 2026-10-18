"use client";

import Link from "next/link";

import { InputField, TextareaField } from "@/components/features/forms/form-fields";
import { useActionForm } from "@/components/features/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { overviewHref } from "@/lib/routes";
import {
  POLL_ARRAY_FIELDS,
  POLL_DESCRIPTION_MAX_LENGTH,
  POLL_THEME_MAX_LENGTH,
  POLL_TITLE_MAX_LENGTH,
  pollFormSchema,
} from "@/lib/validation/poll";
import { createPollAction } from "@/server/actions/polls";
import type { DateKey, TimeOfDay } from "@/server/domain/events/time";
import type { PlaceOption } from "@/server/places/queries";

import { toPlaceChoices } from "../events/event-form-state";

import { datesHint, pollPlanStatus } from "./poll-form-state";
import { PollPlanFields } from "./poll-plan-fields";
import { usePollForm } from "./use-poll-form";

export type PollFormDefaults = {
  /** getSuggestedPollTitle: "Ølsmagning #15". */
  title: string;
  /** suggestPollDates: three dates ("YYYY-MM-DD", Copenhagen). */
  dates: DateKey[];
  /** DEFAULT_POLL_START_TIME ("18:30"). */
  startTime: TimeOfDay;
  /** suggestDeadline(first date), or null when nothing fits. */
  deadline: { date: DateKey; time: TimeOfDay } | null;
};

export type PollFormProps = {
  clubId: string;
  /** listPlaceOptions(clubId): active places, last used first. */
  places: PlaceOption[];
  defaults: PollFormDefaults;
  /** Today in Copenhagen (nextPollDate for "+ Tilføj dato"). */
  today: DateKey;
};

/**
 * "Planlæg ølsmagning" (SPEC §9.7.1, D-134, D-135): a 30-second form. Titel
 * (suggested) → Beskrivelse → Tema (valgfrit, TG-031) → Hvornår? (three
 * suggested dates, one shared start time) → Hvor? (the club's places as
 * checkboxes, plus "＋ Nyt sted") → Afstemningsfrist (follows the first date
 * until touched). Live hints say when a category is fixed, or when there is
 * nothing to vote on (then an event is the right tool).
 *
 * Validated with the shared Zod schema in the browser and again in the
 * Server Action; whether the dates and the deadline lie in the future is
 * decided on the server. Works without JavaScript except "+ Tilføj dato" / ✕
 * (native fields; "＋ Nyt sted" opens with CSS). The page renders the
 * PageHeader (h1) and the Card; this is only the <form>.
 */
export function PollForm({ clubId, places, defaults, today }: PollFormProps) {
  const { state, formProps, fieldErrors, formError, values, revalidate } = useActionForm(
    createPollAction,
    { schema: pollFormSchema, arrayFields: POLL_ARRAY_FIELDS },
  );
  const choices = toPlaceChoices(places);
  const form = usePollForm({
    formRef: formProps.ref,
    revalidate,
    places: choices,
    defaults,
    today,
    echo: values,
  });
  const { summary } = pollPlanStatus(form);

  return (
    <form {...formProps} className="grid gap-7">
      <input type="hidden" name="clubId" value={clubId} />

      {formError ? <FormError>{formError.message}</FormError> : null}

      <InputField
        name="title"
        label="Titel"
        defaultValue={values.title ?? defaults.title}
        maxLength={POLL_TITLE_MAX_LENGTH}
        autoComplete="off"
        required
        errors={fieldErrors.title}
        hint="Næste nummer i rækken. Skriv gerne noget andet."
      />

      <TextareaField
        name="description"
        label="Beskrivelse"
        optional="valgfri"
        placeholder="fx Vi smager juleøl, og alle tager en med."
        defaultValue={values.description ?? ""}
        maxLength={POLL_DESCRIPTION_MAX_LENGTH}
        rows={4}
        errors={fieldErrors.description}
      />

      <InputField
        name="theme"
        label="Tema"
        optional="valgfrit"
        placeholder="fx Juleøl"
        defaultValue={values.theme ?? ""}
        maxLength={POLL_THEME_MAX_LENGTH}
        autoComplete="off"
        errors={fieldErrors.theme}
      />

      <PollPlanFields
        clubId={clubId}
        form={form}
        places={choices}
        today={today}
        hints={{
          dates: datesHint(defaults.dates),
          deadline: "Skal ligge før den første dato. Afstemningen lukker også, når alle har stemt.",
        }}
        errors={fieldErrors}
        newPlaceDefaults={{
          name: values.newPlaceName ?? "",
          address: values.newPlaceAddress ?? "",
          mine: values.newPlaceMine === "on",
        }}
        resetSignal={state}
      />

      <div className="grid grid-cols-1 gap-3 border-t border-border pt-5">
        {summary ? (
          <p aria-live="polite" className="font-semibold break-words text-ink">
            {summary}
          </p>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SubmitButton size="lg" pendingLabel="Opretter afstemningen …">
            Opret afstemning
          </SubmitButton>
          <Button asChild variant="ghost" size="lg">
            <Link href={overviewHref(clubId)}>Annuller</Link>
          </Button>
        </div>
      </div>
    </form>
  );
}
