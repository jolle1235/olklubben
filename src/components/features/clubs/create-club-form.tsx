"use client";

import { useState } from "react";

import { InputField } from "@/components/features/forms/form-fields";
import { useActionForm } from "@/components/features/forms/use-action-form";
import { FormError } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { CLUB_NAME_MAX_LENGTH, createClubSchema } from "@/lib/validation/club";
import { createClub, type ClubFormState } from "@/server/actions/clubs";

/**
 * "Opret ølklub" (SPEC §7.2): one field, the club's name, checked with the
 * same Zod schema in the browser and in the action. On success the action
 * redirects to the new club's Overblik.
 */
export function CreateClubForm() {
  const { formProps, fieldErrors, formError } = useActionForm<ClubFormState>(createClub, {
    schema: createClubSchema,
  });
  // Controlled, so the name survives a failed submit (React resets uncontrolled forms).
  const [name, setName] = useState("");

  return (
    <form {...formProps} className="grid gap-3">
      <InputField
        name="name"
        label="Klubbens navn"
        value={name}
        onChange={(event) => setName(event.target.value)}
        required
        maxLength={CLUB_NAME_MAX_LENGTH}
        autoComplete="off"
        placeholder="fx Drengene & Bajere"
        errors={fieldErrors.name}
      />
      {formError ? <FormError>{formError.message}</FormError> : null}
      <SubmitButton pendingLabel="Opretter klubben …">Opret ølklub</SubmitButton>
    </form>
  );
}
