"use client";

import Link from "next/link";

import { InputField, TextareaField } from "@/components/features/forms/form-fields";
import { useActionForm } from "@/components/features/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { newEventHref, overviewHref } from "@/lib/routes";
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

import { PollDateRows } from "./poll-date-rows";
import { PollDeadlineField } from "./poll-deadline-field";
import {
  datesHint,
  deadlineInstant,
  placeCount,
  pollSummary,
  SHAPE_HINT_TEXT,
  shapeHint,
  validDates,
} from "./poll-form-state";
import { PollPlacePicker } from "./poll-place-picker";
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

  const dateCount = validDates(form.rows).length;
  const selectedPlaces = placeCount(form.selection);
  const hint = shapeHint(dateCount, selectedPlaces);
  const deadline = deadlineInstant(form.deadline);
  const summary = pollSummary({ dateCount, placeCount: selectedPlaces, deadline });
  const [firstDate] = validDates(form.rows);
  const onlyPlace =
    form.selection.placeIds.length === 1 && !form.selection.newPlace
      ? form.selection.placeIds[0]
      : null;

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

      <PollDateRows
        rows={form.rows}
        onAdd={form.addRow}
        onRemove={form.removeRow}
        onChange={form.changeRow}
        startTime={form.startTime}
        onStartTimeChange={form.changeStartTime}
        today={today}
        hint={datesHint(defaults.dates)}
        errors={{ dates: fieldErrors.dates, startTime: fieldErrors.startTime }}
      />

      <PollPlacePicker
        places={choices}
        selection={form.selection}
        onTogglePlace={form.togglePlace}
        onToggleNewPlace={form.toggleNewPlace}
        onChooseExisting={form.chooseExisting}
        newPlaceDefaults={{
          name: values.newPlaceName ?? "",
          address: values.newPlaceAddress ?? "",
          mine: values.newPlaceMine === "on",
        }}
        newPlaceName={form.newPlaceName}
        onNewPlaceNameChange={form.setNewPlaceName}
        errors={{
          placeIds: fieldErrors.placeIds,
          newPlaceName: fieldErrors.newPlaceName,
          newPlaceAddress: fieldErrors.newPlaceAddress,
        }}
        resetSignal={state}
      />

      <div aria-live="polite" className="empty:hidden">
        {hint === "nothing-to-vote" ? (
          <p className="grid grid-cols-1 gap-1 rounded-xl border-2 border-amber bg-amber-tint px-4 py-3 text-ink">
            <span className="font-semibold">{SHAPE_HINT_TEXT[hint]}</span>
            <span className="text-[0.95rem]">
              Tilføj en dato eller et sted mere – eller{" "}
              <Link
                href={newEventHref(clubId, { date: firstDate ?? null, placeId: onlyPlace })}
                className="font-semibold text-olive underline decoration-2 underline-offset-4 hover:decoration-amber"
              >
                opret et event i stedet
              </Link>
              .
            </span>
          </p>
        ) : hint ? (
          <p className="rounded-xl bg-harbor-tint px-4 py-3 text-[0.95rem] text-harbor">
            {SHAPE_HINT_TEXT[hint]}
          </p>
        ) : null}
      </div>

      <PollDeadlineField
        value={form.deadline}
        onChange={form.changeDeadline}
        today={today}
        hint="Skal ligge før den første dato. Afstemningen lukker også, når alle har stemt."
        errors={{ deadlineDate: fieldErrors.deadlineDate, deadlineTime: fieldErrors.deadlineTime }}
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
