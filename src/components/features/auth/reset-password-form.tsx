"use client";

import { SubmitButton } from "@/components/ui/submit-button";
import { withNext } from "@/lib/auth-links";
import { PASSWORD_MIN_LENGTH, resetPasswordSchema } from "@/lib/validation/auth";
import { resetPasswordAction } from "@/server/actions/auth";

import { AuthField } from "./auth-field";
import { ActionErrorAlert } from "./form-alert";
import { TextLink } from "./text-link";
import { useAuthForm } from "./use-auth-form";

const INVALID_TOKEN_CODES = new Set(["INVALID_TOKEN", "TOKEN_EXPIRED"]);

/**
 * "Nyt password" from a reset link (email or admin link, SPEC §6.4). On
 * success every session of the account is logged out and the user is sent
 * to /login?reset=1 (with ?next= when the link had one, e.g. an invitation).
 */
export function ResetPasswordForm({ token, next }: { token: string; next: string | null }) {
  const { formProps, fieldErrors, formError } = useAuthForm(
    resetPasswordAction,
    resetPasswordSchema,
  );
  const tokenRejected = formError !== null && INVALID_TOKEN_CODES.has(formError.code);

  return (
    <form {...formProps} className="grid gap-5">
      <input type="hidden" name="token" value={token} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {formError ? (
        <ActionErrorAlert error={formError}>
          {tokenRejected ? (
            <>
              Linket er udløbet eller allerede brugt.{" "}
              <TextLink href={withNext("/forgot-password", next)} className="text-inherit">
                Bed om et nyt link
              </TextLink>
              .
            </>
          ) : null}
        </ActionErrorAlert>
      ) : null}

      <AuthField
        name="password"
        label="Nyt password"
        type="password"
        autoComplete="new-password"
        autoFocus
        required
        minLength={PASSWORD_MIN_LENGTH}
        errors={fieldErrors.password}
        hint={`Mindst ${PASSWORD_MIN_LENGTH} tegn.`}
      />
      <AuthField
        name="confirmPassword"
        label="Gentag password"
        type="password"
        autoComplete="new-password"
        required
        errors={fieldErrors.confirmPassword}
      />

      <SubmitButton size="lg" className="w-full" pendingLabel="Gemmer …">
        Gem nyt password
      </SubmitButton>
    </form>
  );
}
