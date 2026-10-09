"use client";

import Link from "next/link";

import { InputField, TextareaField } from "@/components/features/forms/form-fields";
import { useActionForm } from "@/components/features/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { clubHref } from "@/lib/routes";
import {
  CLUB_DESCRIPTION_MAX_LENGTH,
  CLUB_NAME_MAX_LENGTH,
  updateClubInfoSchema,
} from "@/lib/validation/club";
import { updateClubInfoAction } from "@/server/actions/clubs";

export type ClubInfoFormProps = {
  clubId: string;
  name: string;
  description: string | null;
};

/**
 * "Rediger klubinfo" (admins, SPEC §7.1, D-110): the club's name (1–60) and
 * a short description (optional, ≤ 300, line breaks kept). Validated with the
 * shared Zod schema in the browser and again in the Server Action, which
 * returns to the club page with "Gemt ✓". Works without JavaScript.
 */
export function ClubInfoForm({ clubId, name, description }: ClubInfoFormProps) {
  const { formProps, fieldErrors, formError, values } = useActionForm(updateClubInfoAction, {
    schema: updateClubInfoSchema,
  });

  return (
    <form {...formProps} className="grid gap-6">
      <input type="hidden" name="clubId" value={clubId} />

      {formError ? <FormError>{formError.message}</FormError> : null}

      <InputField
        name="name"
        label="Klubbens navn"
        defaultValue={values.name ?? name}
        maxLength={CLUB_NAME_MAX_LENGTH}
        autoComplete="off"
        required
        errors={fieldErrors.name}
        hint="Står i klubvælgeren og øverst på klubbens side."
      />

      <TextareaField
        name="description"
        label="Beskrivelse"
        optional="valgfri"
        placeholder="fx Vi smager øl hos hinanden den første fredag i måneden."
        defaultValue={values.description ?? description ?? ""}
        maxLength={CLUB_DESCRIPTION_MAX_LENGTH}
        rows={4}
        errors={fieldErrors.description}
        hint={`Højst ${CLUB_DESCRIPTION_MAX_LENGTH} tegn. Vises under navnet på klubbens side.`}
      />

      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
        <SubmitButton size="lg" pendingLabel="Gemmer …">
          Gem
        </SubmitButton>
        <Button asChild variant="ghost" size="lg">
          <Link href={clubHref(clubId)}>Annuller</Link>
        </Button>
      </div>
    </form>
  );
}
