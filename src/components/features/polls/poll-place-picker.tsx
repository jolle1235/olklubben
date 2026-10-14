"use client";

import { useId, useRef, useState } from "react";

import { CheckboxField, InputField } from "@/components/features/forms/form-fields";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/form-message";
import { PLACE_ADDRESS_MAX_LENGTH, PLACE_NAME_MAX_LENGTH } from "@/server/domain/places/name";

import {
  existingPlaceForName,
  placeChoiceMeta,
  PLACE_SELECTOR_LIMIT,
  PLACE_SELECTOR_SHOWN,
  type PlaceChoice,
} from "../events/event-form-state";
import { PlaceChoiceCard } from "../events/place-choice-card";
import { useCheckedAfterReset } from "../events/use-checked-after-reset";

import type { PlaceSelection } from "./poll-form-state";

export type PollPlacePickerProps = {
  /** The club's active places, last used first. */
  places: readonly PlaceChoice[];
  selection: PlaceSelection;
  onTogglePlace: (placeId: string) => void;
  onToggleNewPlace: () => void;
  /** "Vælg det" (E29): tick the existing place instead of "＋ Nyt sted". */
  onChooseExisting: (placeId: string) => void;
  /** "＋ Nyt sted"'s fields as last submitted (the echo), for their defaultValue. */
  newPlaceDefaults: { name: string; address: string; mine: boolean };
  /** What is typed in "Navn på stedet" (for the "findes allerede" hint). */
  newPlaceName: string;
  onNewPlaceNameChange: (name: string) => void;
  errors: {
    placeIds?: readonly string[];
    newPlaceName?: readonly string[];
    newPlaceAddress?: readonly string[];
  };
  /** Changes with every server answer: React resets the form then (F-053). */
  resetSignal: unknown;
};

/**
 * "Hvor? (mindst ét)" in the poll form (SPEC §9.7.1, D-135): the club's
 * places as native CHECKBOX cards (PlaceChoiceCard type="checkbox",
 * name="placeIds"), last used first – more than six: the first five and
 * "Vis alle N steder". "＋ Nyt sted" (checkbox `newPlace`) reveals Navn /
 * Adresse / "Det er mit sted" with CSS, so it works before hydration; the
 * server finds or creates the place in the poll's transaction (E29), and
 * typing a name the club already has offers [Vælg det].
 */
export function PollPlacePicker({
  places,
  selection,
  onTogglePlace,
  onToggleNewPlace,
  onChooseExisting,
  newPlaceDefaults,
  newPlaceName,
  onNewPlaceNameChange,
  errors,
  resetSignal,
}: PollPlacePickerProps) {
  const baseId = useId();
  const groupRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDetailsElement>(null);
  const many = places.length > PLACE_SELECTOR_LIMIT;
  const shown = many ? places.slice(0, PLACE_SELECTOR_SHOWN) : places;
  const more = many ? places.slice(PLACE_SELECTOR_SHOWN) : [];
  // Rendered open once if a ticked place is hidden; after that the member decides.
  const [initiallyOpen] = useState(() =>
    more.some((place) => selection.placeIds.includes(place.id)),
  );
  const existing = selection.newPlace ? existingPlaceForName(places, newPlaceName) : null;
  const error = errors.placeIds?.[0];
  const errorId = `${baseId}-error`;
  const hintId = `${baseId}-hint`;
  const noPlaces = places.length === 0;

  // React resets the form after a server answer; keep the ticks (F-053).
  useCheckedAfterReset(groupRef, "placeIds", selection.placeIds, resetSignal);
  useCheckedAfterReset(groupRef, "newPlace", selection.newPlace ? ["on"] : [], resetSignal);

  function chooseExisting(placeId: string) {
    if (more.some((place) => place.id === placeId) && moreRef.current) moreRef.current.open = true;
    onChooseExisting(placeId);
    requestAnimationFrame(() => document.getElementById(`${baseId}-${placeId}`)?.focus());
  }

  const describedBy = error ? errorId : noPlaces ? hintId : undefined;
  const card = (place: PlaceChoice) => (
    <PlaceChoiceCard
      key={place.id}
      id={`${baseId}-${place.id}`}
      type="checkbox"
      name="placeIds"
      value={place.id}
      checked={selection.placeIds.includes(place.id)}
      onSelect={onTogglePlace}
      label={place.name}
      meta={placeChoiceMeta(place)}
      describedBy={describedBy}
    />
  );

  return (
    <fieldset className="grid min-w-0 grid-cols-1 gap-2">
      <legend className="mb-2 text-[0.95rem] leading-tight font-semibold text-ink">
        Hvor? <span className="font-normal text-muted-foreground">(mindst ét)</span>
      </legend>
      {noPlaces && !error ? (
        <p id={hintId} className="text-[0.95rem] text-muted-foreground">
          Klubben har ingen steder endnu. Skriv, hvor I mødes.
        </p>
      ) : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}

      <div ref={groupRef} className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {shown.map(card)}
        {more.length > 0 ? (
          <details ref={moreRef} open={initiallyOpen} className="sm:col-span-2">
            <summary className="flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-lg px-1 font-semibold text-olive underline decoration-2 underline-offset-4 hover:decoration-amber">
              Vis alle {places.length} steder
            </summary>
            <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2">{more.map(card)}</div>
          </details>
        ) : null}
        <PlaceChoiceCard
          id={`${baseId}-new`}
          type="checkbox"
          name="newPlace"
          value="on"
          checked={selection.newPlace}
          onSelect={onToggleNewPlace}
          label="＋ Nyt sted"
          describedBy={describedBy}
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
              hint="Så bliver du vært, hvis stedet vinder."
              defaultChecked={newPlaceDefaults.mine}
            />
          </div>
        </PlaceChoiceCard>
      </div>
    </fieldset>
  );
}
