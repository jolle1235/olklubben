"use client";

import { useId, useRef, useState } from "react";

import { ChoiceFieldset, CheckboxField, InputField } from "@/components/features/forms/form-fields";
import { Button } from "@/components/ui/button";
import { EVENT_PLACE_NEW } from "@/lib/validation/event";
import { PLACE_ADDRESS_MAX_LENGTH, PLACE_NAME_MAX_LENGTH } from "@/server/domain/places/name";

import {
  existingPlaceForName,
  placeChoiceMeta,
  splitPlaceChoices,
  type PlaceChoice,
} from "./event-form-state";
import { PlaceChoiceCard } from "./place-choice-card";
import { useCheckedAfterReset } from "./use-checked-after-reset";

export type PlaceSelectorProps = {
  /** The club's active places (+ the event's archived place on edit), last used first. */
  places: readonly PlaceChoice[];
  /** The checked radio: a place id, EVENT_PLACE_NEW or "" (nothing yet). */
  value: string;
  onChange: (placeId: string) => void;
  /** "＋ Nyt sted"'s fields as last submitted (the echo), for their defaultValue. */
  newPlaceDefaults: { name: string; address: string; mine: boolean };
  /** What is typed in "Navn på stedet" (for the "findes allerede" hint). */
  newPlaceName: string;
  onNewPlaceNameChange: (name: string) => void;
  onNewPlaceMineChange: (mine: boolean) => void;
  errors: { placeId?: string[]; newPlaceName?: string[]; newPlaceAddress?: string[] };
  /** Changes with every server answer: React resets the form then (F-053). */
  resetSignal: unknown;
};

/**
 * "Sted" in the event form (SPEC §9.2, D-099): the club's places as native
 * radio cards, last used first, and "＋ Nyt sted" last. With more than six
 * places the first five show and the rest sit in "Vis alle N steder".
 * Choosing "＋ Nyt sted" reveals its fields with CSS, so it works before
 * hydration; the server creates the place in the event's transaction, or
 * reuses an active place with the same name.
 *
 * Typing a name the club already has shows "«Hos Mads» findes allerede."
 * with [Vælg det]. Errors sit under the legend; focusFirstInvalid moves focus
 * to the checked radio, else the first one.
 */
export function PlaceSelector({
  places,
  value,
  onChange,
  newPlaceDefaults,
  newPlaceName,
  onNewPlaceNameChange,
  onNewPlaceMineChange,
  errors,
  resetSignal,
}: PlaceSelectorProps) {
  const baseId = useId();
  const groupRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDetailsElement>(null);
  const { shown, more, moreOpen } = splitPlaceChoices(places, value);
  // Rendered open once if the chosen place is hidden; after that the member decides.
  const [initiallyOpen] = useState(moreOpen);
  const existing = value === EVENT_PLACE_NEW ? existingPlaceForName(places, newPlaceName) : null;
  // Creating in a club without places: "＋ Nyt sted" is pre-selected and open.
  const noPlaces = places.length === 0;

  // React resets the form after a server answer; keep the chosen radio (F-053).
  useCheckedAfterReset(groupRef, "placeId", [value], resetSignal);

  function chooseExisting(placeId: string) {
    if (more.some((place) => place.id === placeId) && moreRef.current) moreRef.current.open = true;
    onChange(placeId);
    // The radio is re-rendered checked; give it focus so the choice is seen.
    requestAnimationFrame(() => document.getElementById(`${baseId}-${placeId}`)?.focus());
  }

  return (
    <ChoiceFieldset
      legend="Sted"
      errors={errors.placeId}
      hint={noPlaces ? "Klubben har ingen steder endnu. Skriv, hvor I mødes." : undefined}
    >
      {(control) => {
        const card = (place: PlaceChoice) => (
          <PlaceChoiceCard
            key={place.id}
            id={`${baseId}-${place.id}`}
            value={place.id}
            checked={value === place.id}
            onSelect={onChange}
            label={place.archived ? `${place.name} (arkiveret)` : place.name}
            meta={placeChoiceMeta(place)}
            describedBy={control["aria-describedby"]}
          />
        );
        return (
          <div ref={groupRef} className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {shown.map(card)}
            {more.length > 0 ? (
              <details ref={moreRef} open={initiallyOpen} className="group/more sm:col-span-2">
                <summary className="flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-lg px-1 font-semibold text-olive underline decoration-2 underline-offset-4 hover:decoration-amber">
                  Vis alle {places.length} steder
                </summary>
                <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2">{more.map(card)}</div>
              </details>
            ) : null}
            <PlaceChoiceCard
              id={`${baseId}-${EVENT_PLACE_NEW}`}
              value={EVENT_PLACE_NEW}
              checked={value === EVENT_PLACE_NEW}
              onSelect={onChange}
              label="＋ Nyt sted"
              describedBy={control["aria-describedby"]}
              className="sm:col-span-2"
            >
              <div className="mt-3 hidden grid-cols-1 gap-5 rounded-xl border border-dashed border-border bg-cream-deep/40 px-4 py-4 group-has-[.place-radio:checked]/choice:grid">
                <div className="grid grid-cols-1 gap-2">
                  <InputField
                    name="newPlaceName"
                    label="Navn på stedet"
                    placeholder="fx Hos Mads"
                    defaultValue={newPlaceDefaults.name}
                    maxLength={PLACE_NAME_MAX_LENGTH}
                    autoComplete="off"
                    errors={errors.newPlaceName}
                    onChange={(event) => onNewPlaceNameChange(event.currentTarget.value)}
                  />
                  <div aria-live="polite">
                    {existing ? (
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-amber bg-amber-tint/70 px-3.5 py-2 text-ink">
                        <span className="min-w-0 break-words hyphens-auto">
                          «{existing.name}» findes allerede.
                        </span>
                        <Button
                          type="button"
                          variant="link"
                          className="min-h-11 px-0"
                          onClick={() => chooseExisting(existing.id)}
                        >
                          Vælg det
                        </Button>
                      </p>
                    ) : null}
                  </div>
                </div>
                <InputField
                  name="newPlaceAddress"
                  label="Adresse"
                  optional="valgfri"
                  placeholder="fx Søndergade 12, 8381 Tilst"
                  defaultValue={newPlaceDefaults.address}
                  maxLength={PLACE_ADDRESS_MAX_LENGTH}
                  autoComplete="off"
                  hint="Så virker 'Åbn i kort'."
                  errors={errors.newPlaceAddress}
                />
                <CheckboxField
                  name="newPlaceMine"
                  label="Det er mit sted"
                  hint="Så bliver du foreslået som vært, når stedet bruges."
                  defaultChecked={newPlaceDefaults.mine}
                  onChange={(event) => onNewPlaceMineChange(event.currentTarget.checked)}
                />
              </div>
            </PlaceChoiceCard>
          </div>
        );
      }}
    </ChoiceFieldset>
  );
}
