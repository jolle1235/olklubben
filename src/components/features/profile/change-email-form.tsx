"use client";

import { InputField, PasswordField } from "@/components/features/forms/form-fields";
import { useActionForm } from "@/components/features/forms/use-action-form";
import { FormError } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { EMAIL_MAX_LENGTH, PASSWORD_MAX_LENGTH } from "@/lib/validation/auth";
import { changeEmailSchema } from "@/lib/validation/profile";
import { changeEmailAction } from "@/server/actions/profile";

/**
 * "Skift email" on Profil (SPEC §9.8, D-151), for accounts with a password
 * login: the new email twice (a typo would lock the other devices out, and
 * there is no confirmation mail yet) and the current password. A wrong
 * password, an email in use and the current email come back on their field
 * (and focus it, D-056). The emails are echoed back after a failed submit,
 * the password never.
 *
 * `email` (the current one) fills a hidden username field, so a password
 * manager knows which account the password belongs to. The page keys this
 * form by the email, so it starts over after a change.
 */
export function ChangeEmailForm({ clubId, email }: { clubId: string; email: string }) {
  const { formProps, fieldErrors, formError, values } = useActionForm(changeEmailAction, {
    schema: changeEmailSchema,
  });

  return (
    <form {...formProps} className="grid gap-6">
      <input type="hidden" name="clubId" value={clubId} />
      <input type="email" autoComplete="username" value={email} readOnly hidden />

      {formError ? <FormError>{formError.message}</FormError> : null}

      <InputField
        type="email"
        name="newEmail"
        label="Ny email"
        defaultValue={values.newEmail}
        autoComplete="email"
        inputMode="email"
        maxLength={EMAIL_MAX_LENGTH}
        required
        errors={fieldErrors.newEmail}
      />
      <InputField
        type="email"
        name="confirmEmail"
        label="Gentag ny email"
        defaultValue={values.confirmEmail}
        autoComplete="email"
        inputMode="email"
        maxLength={EMAIL_MAX_LENGTH}
        required
        errors={fieldErrors.confirmEmail}
      />
      <PasswordField
        name="currentPassword"
        label="Nuværende password"
        autoComplete="current-password"
        maxLength={PASSWORD_MAX_LENGTH}
        required
        errors={fieldErrors.currentPassword}
      />

      <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-center sm:gap-4">
        <SubmitButton pendingLabel="Skifter …">Skift email</SubmitButton>
        <p className="text-[0.95rem] text-muted-foreground">
          Du logger ind med den nye email fra nu af. Dine andre enheder bliver logget ud.
        </p>
      </div>
    </form>
  );
}
