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
import { MAX_EVENT_YEAR, MIN_EVENT_YEAR } from "@/server/domain/events/time";

import type { HostChoice, PlaceChoice } from "./event-form-state";
import { HostsPicker } from "./hosts-picker";
import { PlaceSelector } from "./place-selector";
import { usePlaceAndHosts } from "./use-place-and-hosts";

type TextField = "title" | "date" | "startTime" | "endDate" | "endTime" | "theme" | "description";

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
  /** ?placeId= ("Opret event her"); only an active place of the club is pre-selected. */
  prefillPlaceId?: string | null;
};

/**
 * Create or edit an event (SPEC §9.2): Titel (suggested "Ølsmagning #N") ·
 * Dato/Starttid · Slutdag/Sluttid (an explicit end, also days later, D-176) · Sted (PlaceSelector, with
 * "＋ Nyt sted" inline, D-099) · Værter (HostsPicker, D-098) · Tema ·
 * Beskrivelse/plan. Past dates are fine (old tastings may be registered).
 * Only the title and the date are required: the time, the place and the hosts
 * can be decided later (D-175).
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
  prefillPlaceId,
}: EventFormProps) {
  const editing = eventId !== undefined;
  const { state, formProps, fieldErrors, formError, values, revalidate } = useActionForm(
    editing ? updateEventAction : createEventAction,
    { schema: eventFormSchema, arrayFields: EVENT_ARRAY_FIELDS },
  );
  const initial = (field: TextField) => values[field] ?? defaults[field];
  const [hasStartTime, setHasStartTime] = useState(initial("startTime").trim() !== "");

  const choice = usePlaceAndHosts({
    formRef: formProps.ref,
    revalidate,
    places,
    hostChoices,
    currentUserId,
    prefillPlaceId,
    defaults,
    echo: values,
  });

  function handleChange(event: React.FormEvent<HTMLFormElement>) {
    formProps.onChange(event);
    const start = event.currentTarget.elements.namedItem("startTime");
    setHasStartTime(start instanceof HTMLInputElement && start.value.trim() !== "");
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

      {/* Stacked on phones; start and end side by side from sm. */}
      <fieldset className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
        <legend className="sr-only">Hvornår</legend>
        <InputField
          type="date"
          name="date"
          label="Dato"
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
          optional="valgfri"
          defaultValue={initial("startTime")}
          errors={fieldErrors.startTime}
        />
        <InputField
          type="date"
          name="endDate"
          label="Slutdag"
          optional="valgfri"
          defaultValue={initial("endDate")}
          min={`${MIN_EVENT_YEAR}-01-01`}
          max={`${MAX_EVENT_YEAR}-12-31`}
          errors={fieldErrors.endDate}
          hint={hasStartTime ? undefined : "Varer det flere dage? Vælg den sidste dag."}
        />
        <InputField
          type="time"
          name="endTime"
          label="Sluttid"
          optional="valgfri"
          defaultValue={initial("endTime")}
          errors={fieldErrors.endTime}
          hint={hasStartTime ? undefined : "Kræver en starttid."}
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
