"use client";

import Link from "next/link";
import { useState } from "react";

import { InputField, TextareaField } from "@/components/features/forms/form-fields";
import { useActionForm } from "@/components/features/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  EVENT_ARRAY_FIELDS,
  EVENT_DESCRIPTION_MAX_LENGTH,
  EVENT_THEME_MAX_LENGTH,
  EVENT_TITLE_MAX_LENGTH,
  eventFormSchema,
} from "@/lib/validation/event";
import { createEventAction, updateEventAction } from "@/server/actions/events";
import { MAX_EVENT_YEAR, MIN_EVENT_YEAR, normalizeTimeOfDay } from "@/server/domain/events/time";

import type { HostChoice, PlaceChoice } from "./event-form-state";
import { HostsPicker } from "./hosts-picker";
import { PlaceSelector } from "./place-selector";
import { usePlaceAndHosts } from "./use-place-and-hosts";

type TextField = "title" | "date" | "startTime" | "endTime" | "theme" | "description";

/** The fields' starting values ("YYYY-MM-DD", "HH:mm", "" for empty), plus place and hosts. */
export type EventFormDefaults = Record<TextField, string> & {
  /** Edit: the event's place (kept even when archived, E30). Create: null. */
  placeId: string | null;
  /** Edit: the event's hosts (former members included). Create: null (they follow the place). */
  hostIds: string[] | null;
};

export type EventFormProps = {
  clubId: string;
  /** Set when editing an existing event; otherwise the form creates one. */
  eventId?: string;
  defaults: EventFormDefaults;
  /** "Annuller": Overblik when creating, the event when editing. */
  cancelHref: string;
  /** listPlaceOptions: active places (+ the event's archived place on edit), last used first. */
  places: PlaceChoice[];
  /** The club's members by display name, then hosts who have left (edit). */
  hostChoices: HostChoice[];
  currentUserId: string;
  /** Host when the place has no owners: the user; on edit the event's creator while a member. */
  hostFallback: { userId: string; name: string };
  /** ?placeId= ("Opret event her"); only an active place of the club is pre-selected. */
  prefillPlaceId?: string | null;
};

/** "Slutter dagen efter kl. 01:00." when the end time is before the start time. */
function endTimeHint(startTime: string, endTime: string): string {
  const start = normalizeTimeOfDay(startTime);
  const end = normalizeTimeOfDay(endTime);
  if (start && end && end < start) return `Slutter dagen efter kl. ${end}.`;
  return "Efter midnat? Så slutter det dagen efter.";
}

/**
 * Create or edit an event (SPEC §9.2): Titel (suggested "Ølsmagning #N") ·
 * Dato/Starttid/Sluttid (overnight allowed) · Sted (PlaceSelector, with
 * "＋ Nyt sted" inline, D-099) · Værter (HostsPicker, D-098) · Tema ·
 * Beskrivelse/plan. Past dates are fine (old tastings may be registered).
 *
 * Validated with the shared Zod schema in the browser and again in the Server
 * Action, which also decides the place and hosts under locks. Works without
 * JavaScript: radios, checkboxes and the new place's fields are native (CSS
 * reveals them), and the action redirects on success.
 */
export function EventForm({
  clubId,
  eventId,
  defaults,
  cancelHref,
  places,
  hostChoices,
  currentUserId,
  hostFallback,
  prefillPlaceId,
}: EventFormProps) {
  const editing = eventId !== undefined;
  const { state, formProps, fieldErrors, formError, values, revalidate } = useActionForm(
    editing ? updateEventAction : createEventAction,
    { schema: eventFormSchema, arrayFields: EVENT_ARRAY_FIELDS },
  );
  const initial = (field: TextField) => values[field] ?? defaults[field];
  const [times, setTimes] = useState({ start: initial("startTime"), end: initial("endTime") });

  const choice = usePlaceAndHosts({
    formRef: formProps.ref,
    revalidate,
    places,
    hostChoices,
    currentUserId,
    hostFallback,
    prefillPlaceId,
    defaults,
    echo: values,
  });

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
    <form {...formProps} onChange={handleChange} className="grid gap-7">
      <input type="hidden" name="clubId" value={clubId} />
      {editing ? <input type="hidden" name="eventId" value={eventId} /> : null}

      {formError ? <FormError>{formError.message}</FormError> : null}

      <InputField
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
        <InputField
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
        <InputField
          type="time"
          name="startTime"
          label="Starttid"
          defaultValue={initial("startTime")}
          required
          errors={fieldErrors.startTime}
        />
        <InputField
          type="time"
          name="endTime"
          label="Sluttid"
          optional="valgfri"
          defaultValue={initial("endTime")}
          errors={fieldErrors.endTime}
          hint={endTimeHint(times.start, times.end)}
        />
      </fieldset>

      <PlaceSelector
        places={places}
        value={choice.placeId}
        onChange={choice.selectPlace}
        newPlaceDefaults={{
          name: values.newPlaceName ?? "",
          address: values.newPlaceAddress ?? "",
          mine: values.newPlaceMine === "on",
        }}
        newPlaceName={choice.newPlaceName}
        onNewPlaceNameChange={choice.setNewPlaceName}
        onNewPlaceMineChange={choice.setNewPlaceMine}
        errors={{
          placeId: fieldErrors.placeId,
          newPlaceName: fieldErrors.newPlaceName,
          newPlaceAddress: fieldErrors.newPlaceAddress,
        }}
        resetSignal={state}
      />

      <HostsPicker
        choices={hostChoices}
        currentUserId={currentUserId}
        state={choice.hosts}
        onStateChange={choice.changeHosts}
        suggestion={choice.suggestion}
        fallback={{ isSelf: hostFallback.userId === currentUserId, name: hostFallback.name }}
        errors={fieldErrors.hostIds}
        resetSignal={state}
      />

      <InputField
        name="theme"
        label="Tema"
        optional="valgfrit"
        placeholder="fx Belgiske øl"
        defaultValue={initial("theme")}
        maxLength={EVENT_THEME_MAX_LENGTH}
        autoComplete="off"
        errors={fieldErrors.theme}
      />

      <TextareaField
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
