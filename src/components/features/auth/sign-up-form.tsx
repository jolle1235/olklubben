"use client";

import { useId } from "react";

import { useActionForm } from "@/components/features/forms/use-action-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { withNext } from "@/lib/auth-links";
import { PASSWORD_MIN_LENGTH, signUpSchema } from "@/lib/validation/auth";
import { signUpAction } from "@/server/actions/auth";

import { AuthField } from "./auth-field";
import { ActionErrorAlert } from "./form-alert";
import { useRememberedEmails } from "./use-remembered-emails";
import { TextLink } from "./text-link";

const EMAIL_TAKEN_CODES = new Set(["USER_ALREADY_EXISTS", "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"]);

/**
 * "Opret konto" (SPEC §6.1): name, email, password and "Gentag password".
 * The new user is logged in right away and sent to ?next= or "/" (§10.1).
 */
export function SignUpForm({ next }: { next: string | null }) {
  const { formProps, fieldErrors, formError, values, serverError } = useActionForm(signUpAction, {
    schema: signUpSchema,
    // Runs on submit, after `remembered` exists.
    onValidSubmit: (form) => remembered.onValidSubmit(form),
  });
  const remembered = useRememberedEmails(serverError);
  const alertId = useId();
  const emailTaken = formError !== null && EMAIL_TAKEN_CODES.has(formError.code);

  return (
    <form {...formProps} className="grid gap-5">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {formError ? (
        <ActionErrorAlert id={alertId} error={formError}>
          {emailTaken ? (
            <>
              Der findes allerede en konto med den email.{" "}
              <TextLink href={withNext("/login", next)} className="text-inherit">
                Log ind i stedet
              </TextLink>{" "}
              eller{" "}
              <TextLink href={withNext("/forgot-password", next)} className="text-inherit">
                nulstil dit password
              </TextLink>
              .
            </>
          ) : null}
        </ActionErrorAlert>
      ) : null}

      <AuthField
        name="name"
        label="Navn"
        autoComplete="name"
        autoCapitalize="words"
        autoFocus
        required
        defaultValue={values.name}
        errors={fieldErrors.name}
        hint="Sådan ser klubben dig. Kan ændres senere."
      />
      <AuthField
        name="email"
        suggestions={remembered.emails}
        label="Email"
        type="email"
        autoComplete="email"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        defaultValue={values.email}
        errors={fieldErrors.email}
        invalid={emailTaken}
        describedBy={emailTaken ? alertId : undefined}
      />
      <AuthField
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
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

      <SubmitButton size="lg" className="w-full" pendingLabel="Opretter konto …">
        Opret konto
      </SubmitButton>
    </form>
  );
}
