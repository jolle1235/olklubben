"use client";

import { useId } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { FieldError, FormError } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/ui/submit-button";
import { ABV_INPUT_MAX_LENGTH } from "@/server/domain/beers/abv";

import type { BeerNameEntry } from "./catalog-view";
import { DuplicateBeerWarning } from "./duplicate-beer-warning";
import { useBeerForm, type BeerFormDefaults } from "./use-beer-form";

export type BeerFormProps = {
  mode: "create" | "edit";
  clubId: string;
  /** Required when editing. */
  beerId?: string;
  defaults: BeerFormDefaults;
  /** The club's events, newest first, with a ready label ("Ølsmagning #12 · 14. sep 2026"). */
  events: { id: string; label: string }[];
  /** The club's other beers, for the live duplicate warning. */
  existingBeers: BeerNameEntry[];
  /** Where "Annuller" goes. */
  cancelHref: string;
};

/**
 * "Tilføj øl" / "Rediger øl" (SPEC §9.5): navn, alkoholprocent ("5,2" or
 * "5.2") and an optional event of this club. A name the club already has
 * shows "Den her har I vist smagt før 👀" (E21); the button then says
 * "Tilføj alligevel" and confirms the duplicate. Adding opens the new beer's
 * page, ready to rate (§10.5).
 */
export function BeerForm({
  mode,
  clubId,
  beerId,
  defaults,
  events,
  existingBeers,
  cancelHref,
}: BeerFormProps) {
  const form = useBeerForm({ mode, defaults, existingBeers });
  const id = useId();
  const ids = {
    name: `${id}-name`,
    abv: `${id}-abv`,
    event: `${id}-event`,
    duplicate: `${id}-duplicate`,
  };
  const errors = form.fieldErrors;
  const hasDuplicates = form.duplicates.length > 0;
  const submitLabel =
    mode === "create"
      ? hasDuplicates
        ? "Tilføj alligevel"
        : "Tilføj øl"
      : hasDuplicates
        ? "Gem alligevel"
        : "Gem ændringer";

  function describedBy(field: "name" | "abv" | "event", extra?: string | false) {
    return (
      [errors[field === "event" ? "eventId" : field]?.[0] ? `${ids[field]}-error` : null, extra]
        .filter(Boolean)
        .join(" ") || undefined
    );
  }

  return (
    <form {...form.formProps} className="grid gap-5">
      <input type="hidden" name="clubId" value={clubId} />
      {beerId ? <input type="hidden" name="beerId" value={beerId} /> : null}
      <input type="hidden" name="confirmDuplicate" value={hasDuplicates ? "1" : ""} />

      {form.formError ? <FormError>{form.formError}</FormError> : null}

      <div className="grid gap-2">
        <Label htmlFor={ids.name}>Navn</Label>
        <Input
          ref={form.register("name")}
          id={ids.name}
          name="name"
          value={form.values.name}
          onChange={(event) => form.setValue("name", event.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="fx Grimbergen Dubbel"
          aria-invalid={errors.name?.[0] ? true : undefined}
          aria-describedby={describedBy("name", hasDuplicates && ids.duplicate)}
        />
        {errors.name?.[0] ? (
          <FieldError id={`${ids.name}-error`}>{errors.name[0]}</FieldError>
        ) : null}
        <div aria-live="polite">
          {hasDuplicates ? (
            <DuplicateBeerWarning
              id={ids.duplicate}
              beers={form.duplicates}
              clubId={clubId}
              verb={mode === "create" ? "tilføje" : "gemme"}
            />
          ) : null}
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={ids.abv}>Alkoholprocent</Label>
        <div className="relative sm:max-w-48">
          <Input
            ref={form.register("abv")}
            id={ids.abv}
            name="abv"
            value={form.values.abv}
            onChange={(event) => form.setValue("abv", event.target.value)}
            inputMode="decimal"
            maxLength={ABV_INPUT_MAX_LENGTH}
            autoComplete="off"
            placeholder="fx 5,2"
            className="pr-10"
            aria-invalid={errors.abv?.[0] ? true : undefined}
            aria-describedby={describedBy("abv")}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-muted-foreground"
          >
            %
          </span>
        </div>
        {errors.abv?.[0] ? <FieldError id={`${ids.abv}-error`}>{errors.abv[0]}</FieldError> : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor={ids.event}>
          Event <span className="font-normal text-muted-foreground">(valgfrit)</span>
        </Label>
        <NativeSelect
          ref={form.register("eventId")}
          id={ids.event}
          name="eventId"
          value={form.values.eventId}
          onChange={(event) => form.setValue("eventId", event.target.value)}
          aria-invalid={errors.eventId?.[0] ? true : undefined}
          aria-describedby={describedBy("event")}
        >
          <option value="">Intet event</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.label}
            </option>
          ))}
        </NativeSelect>
        {errors.eventId?.[0] ? (
          <FieldError id={`${ids.event}-error`}>{errors.eventId[0]}</FieldError>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
        <SubmitButton pending={form.pending} pendingLabel="Gemmer …" size="lg">
          {submitLabel}
        </SubmitButton>
        <Button asChild variant="ghost" size="lg">
          <Link href={cancelHref}>Annuller</Link>
        </Button>
      </div>
    </form>
  );
}
