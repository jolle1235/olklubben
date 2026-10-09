"use client";

import { useState } from "react";

import { InputField } from "@/components/features/forms/form-fields";
import { useActionForm } from "@/components/features/forms/use-action-form";
import { FormError } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatMemberName } from "@/lib/format/display-name";
import { cleanSingleLine } from "@/lib/text";
import { USER_NAME_MAX_LENGTH } from "@/lib/validation/auth";
import { NICKNAME_MAX_LENGTH, updateProfileSchema } from "@/lib/validation/profile";
import { updateProfileAction } from "@/server/actions/profile";

export type ProfileFormProps = {
  clubId: string;
  /** The saved official name. */
  name: string;
  /** The saved nickname, or null. */
  nickname: string | null;
};

/**
 * "Navn og kælenavn" on Profil (SPEC §9.8, D-105): the official name and the
 * global nickname, with a live preview of how the member list shows you
 * ("Kaptajnen (Jesper Thomsen)"). Everywhere else the nickname replaces the
 * name.
 *
 * Validated with the shared Zod schema in the browser and in the Server
 * Action, which comes back to Profil with "Gemt ✓". The page keys this form
 * by the saved values, so it starts over from them after a save. The inputs
 * are controlled (for the preview), which also keeps what was typed after a
 * failed server submit.
 */
export function ProfileForm({
  clubId,
  name: savedName,
  nickname: savedNickname,
}: ProfileFormProps) {
  const { formProps, fieldErrors, formError } = useActionForm(updateProfileAction, {
    schema: updateProfileSchema,
  });
  const [name, setName] = useState(savedName);
  const [nickname, setNickname] = useState(savedNickname ?? "");

  const cleanName = cleanSingleLine(name);
  const cleanNickname = cleanSingleLine(nickname);
  const preview =
    cleanName || cleanNickname
      ? formatMemberName({ name: cleanName, nickname: cleanNickname || null })
      : null;

  return (
    <form {...formProps} className="grid gap-6">
      <input type="hidden" name="clubId" value={clubId} />

      {formError ? <FormError>{formError.message}</FormError> : null}

      <InputField
        name="name"
        label="Navn"
        value={name}
        onChange={(event) => setName(event.target.value)}
        autoComplete="name"
        maxLength={USER_NAME_MAX_LENGTH}
        required
        errors={fieldErrors.name}
        hint="Dit rigtige navn. Har du et kælenavn, står navnet i parentes på medlemslisten."
      />

      <InputField
        name="nickname"
        label="Kælenavn"
        optional="valgfrit"
        value={nickname}
        onChange={(event) => setNickname(event.target.value)}
        autoComplete="nickname"
        maxLength={NICKNAME_MAX_LENGTH}
        placeholder="fx Kaptajnen"
        errors={fieldErrors.nickname}
        hint="Vises i stedet for dit navn i alle dine klubber."
      />

      {preview ? (
        <p className="rounded-lg bg-cream-deep px-4 py-3 text-[0.95rem] break-words hyphens-auto text-muted-foreground">
          Sådan ser de andre dig: <span className="font-semibold text-ink">{preview}</span>
        </p>
      ) : null}

      <SubmitButton pendingLabel="Gemmer …" className="self-stretch sm:justify-self-start">
        Gem profil
      </SubmitButton>
    </form>
  );
}
