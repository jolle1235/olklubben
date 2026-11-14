"use client";

import { GoogleSignInButton } from "@/components/features/auth/google-sign-in";
import { PasswordField } from "@/components/features/forms/form-fields";
import { useActionForm } from "@/components/features/forms/use-action-form";
import { FormError } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { ACTION_ERROR_CODES } from "@/lib/action-result";
import { profileHref } from "@/lib/routes";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/validation/auth";
import { setPasswordSchema } from "@/lib/validation/profile";
import { setPasswordAction } from "@/server/actions/profile";

type ReauthProps = {
  clubId: string;
  /** The account's email: Google's chooser pre-selects it (loginHint). */
  email: string;
  /** Whether Google is configured (isGoogleConfigured), so the button works. */
  available: boolean;
};

/**
 * "Tilføj password" on Profil for an account with only a Google login (SPEC
 * §9.8, D-152): a first password, twice, so the account can also log in with
 * email and password. Only shown while the Google login is less than 10
 * minutes old (the page decides); the Server Action checks again. If the page
 * was left open too long, the action answers REAUTH_REQUIRED and the form
 * turns into the same explanation and "Log ind med Google igen" button the
 * page shows.
 *
 * `email` fills a hidden username field, so a password manager saves the new
 * password for the right account. Passwords are never echoed back. After
 * success the page shows "Skift password" instead.
 */
export function SetPasswordForm({ clubId, email, available }: ReauthProps) {
  const { formProps, fieldErrors, formError } = useActionForm(setPasswordAction, {
    schema: setPasswordSchema,
  });

  if (formError?.code === ACTION_ERROR_CODES.REAUTH_REQUIRED) {
    return (
      <div className="grid gap-4">
        <FormError>{formError.message}</FormError>
        <GoogleReauth clubId={clubId} email={email} available={available} />
      </div>
    );
  }

  return (
    <form {...formProps} className="grid gap-6">
      <input type="hidden" name="clubId" value={clubId} />
      <input type="email" autoComplete="username" value={email} readOnly hidden />

      <p className="text-lead text-muted-foreground">
        Vælg et password, så du også kan logge ind med email.
      </p>

      {formError ? <FormError>{formError.message}</FormError> : null}

      <PasswordField
        name="newPassword"
        label="Nyt password"
        autoComplete="new-password"
        minLength={PASSWORD_MIN_LENGTH}
        maxLength={PASSWORD_MAX_LENGTH}
        required
        errors={fieldErrors.newPassword}
        hint={`Mindst ${PASSWORD_MIN_LENGTH} tegn.`}
      />
      <PasswordField
        name="confirmPassword"
        label="Gentag nyt password"
        autoComplete="new-password"
        maxLength={PASSWORD_MAX_LENGTH}
        required
        errors={fieldErrors.confirmPassword}
      />

      <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-center sm:gap-4">
        <SubmitButton pendingLabel="Gemmer …">Gem password</SubmitButton>
        <p className="text-body-sm text-muted-foreground">Dine andre enheder bliver logget ud.</p>
      </div>
    </form>
  );
}

/**
 * Why "Tilføj password" needs a fresh Google login, with "Log ind med Google
 * igen" (when Google is configured). Google's chooser opens with the account's
 * email pre-selected (prompt=select_account, login_hint; never prompt=login,
 * which Google does not know, F-097), and the login comes back to Profil with
 * a new session, so the form shows. Choosing another account in the chooser
 * logs into that account instead (accepted, D-152).
 */
export function GoogleReauth({ clubId, email, available }: ReauthProps) {
  return (
    <div className="grid gap-4">
      <p className="text-lead text-muted-foreground">
        Af sikkerhedshensyn skal du have logget ind med Google for nylig, før du kan tilføje et
        password.
      </p>
      {available ? (
        <GoogleSignInButton
          callbackURL={profileHref(clubId)}
          errorCallbackURL={profileHref(clubId)}
          loginHint={email}
          className="w-full sm:w-auto sm:justify-self-start"
        >
          Log ind med Google igen
        </GoogleSignInButton>
      ) : null}
    </div>
  );
}
