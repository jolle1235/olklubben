"use client";

import { InputField } from "@/components/features/forms/form-fields";
import { useActionForm } from "@/components/features/forms/use-action-form";
import { FormError } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/validation/auth";
import { changePasswordSchema } from "@/lib/validation/profile";
import { changePasswordAction } from "@/server/actions/profile";

/**
 * "Skift password" on Profil (SPEC §9.8, D-106), for accounts with a
 * password login. A wrong current password is shown on that field (and
 * focused, D-056). After the change this device stays logged in, every other
 * device is logged out and old reset links stop working; Profil says so in
 * a toast. Passwords are never echoed back, so a failed submit clears them.
 *
 * `email` fills a hidden username field, so password managers know which
 * account the new password belongs to.
 */
export function ChangePasswordForm({ clubId, email }: { clubId: string; email: string }) {
  // A wrong current password comes back as a field error with its own code
  // (INVALID_PASSWORD); useActionForm shows it on the field only, not twice.
  const { formProps, fieldErrors, formError } = useActionForm(changePasswordAction, {
    schema: changePasswordSchema,
  });

  return (
    <form {...formProps} className="grid gap-6">
      <input type="hidden" name="clubId" value={clubId} />
      <input type="email" autoComplete="username" value={email} readOnly hidden />

      {formError ? <FormError>{formError.message}</FormError> : null}

      <InputField
        type="password"
        name="currentPassword"
        label="Nuværende password"
        autoComplete="current-password"
        maxLength={PASSWORD_MAX_LENGTH}
        required
        errors={fieldErrors.currentPassword}
      />
      <InputField
        type="password"
        name="newPassword"
        label="Nyt password"
        autoComplete="new-password"
        minLength={PASSWORD_MIN_LENGTH}
        maxLength={PASSWORD_MAX_LENGTH}
        required
        errors={fieldErrors.newPassword}
        hint={`Mindst ${PASSWORD_MIN_LENGTH} tegn.`}
      />
      <InputField
        type="password"
        name="confirmPassword"
        label="Gentag nyt password"
        autoComplete="new-password"
        maxLength={PASSWORD_MAX_LENGTH}
        required
        errors={fieldErrors.confirmPassword}
      />

      <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-center sm:gap-4">
        <SubmitButton pendingLabel="Skifter …">Skift password</SubmitButton>
        <p className="text-[0.95rem] text-muted-foreground">Dine andre enheder bliver logget ud.</p>
      </div>
    </form>
  );
}
