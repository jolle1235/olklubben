"use client";

import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { CheckboxField, InputField, TextareaField } from "@/components/features/forms/form-fields";
import { useActionForm } from "@/components/features/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { ACTION_ERROR_CODES } from "@/lib/action-result";
import { placeHref } from "@/lib/routes";
import { createPlaceSchema, placeFieldsSchema } from "@/lib/validation/place";
import { createPlaceAction, updatePlaceAction, type PlaceFormState } from "@/server/actions/places";
import {
  PLACE_ADDRESS_MAX_LENGTH,
  PLACE_DESCRIPTION_MAX_LENGTH,
  PLACE_NAME_MAX_LENGTH,
} from "@/server/domain/places/name";

/** The fields' starting values ("" for empty). */
export type PlaceFormDefaults = { name: string; address: string; description: string };

export type PlaceFormProps = {
  clubId: string;
  /** Set when editing; otherwise the form creates a place (with "Det er mit sted"). */
  placeId?: string;
  defaults: PlaceFormDefaults;
  /** "Annuller": Steder when creating, the place when editing. */
  cancelHref: string;
};

/**
 * Create or edit a place (SPEC §9.4): name, address (for "Åbn i kort",
 * D-101), description and, when creating, "Det er mit sted". Every member may
 * do both (§5.1), archived places too.
 *
 * Validated with the shared Zod schema in the browser and again in the Server
 * Action (useActionForm). A name another active place already has comes back
 * as the name's error with a link to that place (D-095). Works without
 * JavaScript: native inputs, and the action redirects on success.
 */
export function PlaceForm({ clubId, placeId, defaults, cancelHref }: PlaceFormProps) {
  const editing = placeId !== undefined;
  const { state, formProps, fieldErrors, formError, serverError, values } =
    useActionForm<PlaceFormState>(editing ? updatePlaceAction : createPlaceAction, {
      schema: editing ? placeFieldsSchema : createPlaceSchema,
    });
  const initial = (field: keyof PlaceFormDefaults) => values[field] ?? defaults[field];
  // Shown with the name's error (hidden again while the browser re-validates).
  const nameTaken = serverError?.code === ACTION_ERROR_CODES.PLACE_NAME_TAKEN;
  const existing = nameTaken && state && !state.ok ? state.existing : undefined;

  return (
    <form {...formProps} className="grid gap-6">
      <input type="hidden" name="clubId" value={clubId} />
      {editing ? <input type="hidden" name="placeId" value={placeId} /> : null}

      {formError ? <FormError>{formError.message}</FormError> : null}

      <div className="grid gap-2">
        <InputField
          name="name"
          label="Navn"
          placeholder="fx Hos Mads"
          defaultValue={initial("name")}
          maxLength={PLACE_NAME_MAX_LENGTH}
          autoComplete="off"
          required
          errors={fieldErrors.name}
        />
        {existing ? (
          <Link
            href={placeHref(clubId, existing.id)}
            className="inline-flex min-h-11 w-fit max-w-full items-center gap-2 font-semibold text-primary underline decoration-2 underline-offset-4 hover:decoration-amber"
          >
            <span className="min-w-0 break-words hyphens-auto">Gå til «{existing.name}»</span>
            <ArrowRightIcon aria-hidden className="size-4 shrink-0" />
          </Link>
        ) : null}
      </div>

      <InputField
        name="address"
        label="Adresse"
        optional="valgfri"
        defaultValue={initial("address")}
        maxLength={PLACE_ADDRESS_MAX_LENGTH}
        autoComplete="off"
        errors={fieldErrors.address}
        hint="Bruges til 'Åbn i kort', fx Søndergade 12, 8381 Tilst"
      />

      <TextareaField
        name="description"
        label="Beskrivelse"
        optional="valgfri"
        placeholder="fx Ring på bagdøren"
        defaultValue={initial("description")}
        maxLength={PLACE_DESCRIPTION_MAX_LENGTH}
        rows={4}
        errors={fieldErrors.description}
      />

      {editing ? null : (
        <CheckboxField
          name="makeMeOwner"
          label="Det er mit sted"
          defaultChecked={values.makeMeOwner === "on"}
          errors={fieldErrors.makeMeOwner}
          hint="Så bliver du foreslået som vært, når stedet bruges til en smagning."
        />
      )}

      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
        <SubmitButton size="lg" pendingLabel={editing ? "Gemmer …" : "Opretter stedet …"}>
          {editing ? "Gem ændringer" : "Opret sted"}
        </SubmitButton>
        <Button asChild variant="ghost" size="lg">
          <Link href={cancelHref}>Annuller</Link>
        </Button>
      </div>
    </form>
  );
}
