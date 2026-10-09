"use client";

import { useId } from "react";

import { SubmitButton } from "@/components/ui/submit-button";
import { AUTH_ERROR_MESSAGES } from "@/lib/auth-errors";
import { withNext } from "@/lib/auth-links";
import { signInSchema } from "@/lib/validation/auth";
import { signInAction } from "@/server/actions/auth";

import { AuthField } from "./auth-field";
import { ActionErrorAlert } from "./form-alert";
import { TextLink } from "./text-link";
import { useAuthForm } from "./use-auth-form";

/**
 * "Log ind" with email and password (SPEC §6.3). The error never says whether
 * the email exists. On success the action redirects to ?next= or "/".
 */
export function SignInForm({ next }: { next: string | null }) {
  const { formProps, fieldErrors, formError, values } = useAuthForm(signInAction, signInSchema);
  const alertId = useId();
  // "Forkert email eller password" concerns both fields.
  const credentialsRejected = formError?.message === AUTH_ERROR_MESSAGES.invalidCredentials;

  return (
    <form {...formProps} className="grid gap-5">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {formError ? <ActionErrorAlert id={alertId} error={formError} /> : null}

      <AuthField
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        autoFocus
        required
        defaultValue={values.email}
        errors={fieldErrors.email}
        invalid={credentialsRejected}
        describedBy={formError ? alertId : undefined}
      />

      <div className="grid gap-1">
        <AuthField
          name="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          errors={fieldErrors.password}
          invalid={credentialsRejected}
          describedBy={formError ? alertId : undefined}
        />
        <div className="flex justify-end">
          <TextLink
            href={withNext("/forgot-password", next)}
            className="inline-flex min-h-11 items-center text-[0.95rem]"
          >
            Glemt password?
          </TextLink>
        </div>
      </div>

      <SubmitButton size="lg" className="w-full" pendingLabel="Logger ind …">
        Log ind
      </SubmitButton>
    </form>
  );
}
