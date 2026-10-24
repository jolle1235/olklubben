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
  const { formProps, fieldErrors, formError, values, state } = useActionForm(signUpAction, {
    schema: signUpSchema,
  });
  const alertId = useId();
  const emailListId = useId();
  const remembered = useRememberedEmails(state);
  const emailTaken = formError !== null && EMAIL_TAKEN_CODES.has(formError.code);

  return (
    <form
      {...formProps}
      onSubmit={(event) => {
        formProps.onSubmit(event);
        if (!event.defaultPrevented) remembered.rememberOnSubmit(event.currentTarget);
      }}
      className="grid gap-5"
    >
      <datalist id={emailListId}>
        {remembered.emails.map((email) => (
          <option key={email} value={email} />
        ))}
      </datalist>
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
        list={remembered.emails.length > 0 ? emailListId : undefined}
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
