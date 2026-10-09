"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  EVENT_DESCRIPTION_MAX_LENGTH,
  EVENT_LOCATION_MAX_LENGTH,
  EVENT_THEME_MAX_LENGTH,
  EVENT_TITLE_MAX_LENGTH,
} from "@/lib/validation/event";
import { createEventAction, updateEventAction, type EventFormField } from "@/server/actions/events";
import { MAX_EVENT_YEAR, MIN_EVENT_YEAR, normalizeTimeOfDay } from "@/server/domain/events/time";

import { EventInputField, EventTextareaField } from "./event-form-field";
import { useEventForm } from "./use-event-form";

/** The fields' starting values: "YYYY-MM-DD", "HH:mm", "" for empty. */
export type EventFormDefaults = Record<EventFormField, string>;

export type EventFormProps = {
  clubId: string;
  /** Set when editing an existing event; otherwise the form creates one. */
  eventId?: string;
  defaults: EventFormDefaults;
  /** "Annuller": Overblik when creating, the event when editing. */
  cancelHref: string;
};

/** "Slutter dagen efter kl. 01:00." when the end time is before the start time. */
function endTimeHint(startTime: string, endTime: string): string {
  const start = normalizeTimeOfDay(startTime);
  const end = normalizeTimeOfDay(endTime);
  if (start && end && end < start) return `Slutter dagen efter kl. ${end}.`;
  return "Efter midnat? Så slutter det dagen efter.";
}

/**
 * Create or edit an event (SPEC §9.2, D-022): title (suggested "Ølsmagning
 * #N"), date, start time (default 18:30), optional end time (overnight
 * allowed), place as free text, optional theme and plan. Past dates are fine
 * (old tastings may be registered).
 *
 * Validated with the shared Zod schema in the browser and again in the Server
 * Action. Works without JavaScript: the inputs are native, and the action
 * redirects on success.
 */
export function EventForm({ clubId, eventId, defaults, cancelHref }: EventFormProps) {
  const editing = eventId !== undefined;
  const { formProps, fieldErrors, formError, values } = useEventForm(
    editing ? updateEventAction : createEventAction,
  );
  const initial = (field: EventFormField) => values[field] ?? defaults[field];
  const [times, setTimes] = useState({ start: defaults.startTime, end: defaults.endTime });

  function handleChange(event: React.FormEvent<HTMLFormElement>) {
    formProps.onChange(event);
    const { elements } = event.currentTarget;
    const read = (name: string) => {
      const element = elements.namedItem(name);
      return element instanceof HTMLInputElement ? element.value : "";
    };
    setTimes({ start: read("startTime"), end: read("endTime") });
  }

  return (
    <form {...formProps} onChange={handleChange} className="grid gap-6">
      <input type="hidden" name="clubId" value={clubId} />
      {editing ? <input type="hidden" name="eventId" value={eventId} /> : null}

      {formError ? <FormError>{formError.message}</FormError> : null}

      <EventInputField
        name="title"
        label="Titel"
        defaultValue={initial("title")}
        maxLength={EVENT_TITLE_MAX_LENGTH}
        autoComplete="off"
        required
        errors={fieldErrors.title}
        hint={editing ? undefined : "Næste nummer i rækken. Skriv gerne noget andet."}
      />

      <fieldset className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <legend className="sr-only">Hvornår</legend>
        <EventInputField
          type="date"
          name="date"
          label="Dato"
          className="col-span-2 sm:col-span-1"
          defaultValue={initial("date")}
          min={`${MIN_EVENT_YEAR}-01-01`}
          max={`${MAX_EVENT_YEAR}-12-31`}
          required
          errors={fieldErrors.date}
        />
        <EventInputField
          type="time"
          name="startTime"
          label="Starttid"
          defaultValue={initial("startTime")}
          required
          errors={fieldErrors.startTime}
        />
        <EventInputField
          type="time"
          name="endTime"
          label="Sluttid"
          optional="valgfri"
          defaultValue={initial("endTime")}
          errors={fieldErrors.endTime}
          hint={endTimeHint(times.start, times.end)}
        />
      </fieldset>

      <EventInputField
        name="locationText"
        label="Sted"
        placeholder="fx Hos Mads"
        defaultValue={initial("locationText")}
        maxLength={EVENT_LOCATION_MAX_LENGTH}
        autoComplete="off"
        required
        errors={fieldErrors.locationText}
        hint="En adresse, eller hvem der lægger hus til."
      />

      <EventInputField
        name="theme"
        label="Tema"
        optional="valgfrit"
        placeholder="fx Belgiske øl"
        defaultValue={initial("theme")}
        maxLength={EVENT_THEME_MAX_LENGTH}
        autoComplete="off"
        errors={fieldErrors.theme}
      />

      <EventTextareaField
        name="description"
        label="Beskrivelse / plan"
        optional="valgfri"
        placeholder="fx Vi starter med en øl fra Tyskland, derefter blindsmagning og pizza."
        defaultValue={initial("description")}
        maxLength={EVENT_DESCRIPTION_MAX_LENGTH}
        rows={5}
        errors={fieldErrors.description}
      />

      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
        <SubmitButton size="lg" pendingLabel={editing ? "Gemmer …" : "Opretter eventet …"}>
          {editing ? "Gem ændringer" : "Opret event"}
        </SubmitButton>
        <Button asChild variant="ghost" size="lg">
          <Link href={cancelHref}>Annuller</Link>
        </Button>
      </div>
    </form>
  );
}
