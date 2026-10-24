"use client";

import { useId, useRef } from "react";

import { useActionForm } from "@/components/features/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { AUTH_ERROR_MESSAGES } from "@/lib/auth-errors";
import { withNext } from "@/lib/auth-links";
import { signInSchema } from "@/lib/validation/auth";
import { signInAction } from "@/server/actions/auth";

import { AuthField } from "./auth-field";
import { ActionErrorAlert } from "./form-alert";
import { useRememberedEmails } from "./use-remembered-emails";
import { TextLink } from "./text-link";

/**
 * "Log ind" with email and password (SPEC §6.3). The email field suggests the
 * emails used on this device (D-157). The error never says whether
 * the email exists. On success the action redirects to ?next= or "/".
 */
export function SignInForm({ next }: { next: string | null }) {
  const { formProps, fieldErrors, formError, values, serverError, revalidate } = useActionForm(
    signInAction,
    // Runs on submit, after `remembered` exists.
    { schema: signInSchema, onValidSubmit: (form) => remembered.onValidSubmit(form) },
  );
  const remembered = useRememberedEmails(serverError);
  const alertId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  // "Forkert email eller password" concerns both fields.
  const credentialsRejected = formError?.message === AUTH_ERROR_MESSAGES.invalidCredentials;

  return (
    <form {...formProps} className="grid gap-5">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {formError ? <ActionErrorAlert id={alertId} error={formError} /> : null}

      <AuthField
        name="email"
        ref={emailRef}
        suggestions={remembered.emails}
        label="Email"
        type="email"
        autoComplete="username"
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
      {remembered.emails.length > 0 ? (
        <div className="-mt-2 flex flex-wrap items-center gap-2 text-[0.95rem]">
          <span className="text-muted-foreground">Brugt før:</span>
          {remembered.emails.map((email) => (
            <Button
              key={email}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (emailRef.current) emailRef.current.value = email;
                revalidate();
                passwordRef.current?.focus();
              }}
              className="max-w-full rounded-full font-normal"
            >
              <span className="truncate">{email}</span>
            </Button>
          ))}
        </div>
      ) : null}

      <div className="grid gap-1">
        <AuthField
          name="password"
          label="Password"
          type="password"
          ref={passwordRef}
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
