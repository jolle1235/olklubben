"use client";

import { MailCheckIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { withNext } from "@/lib/auth-links";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { requestPasswordResetAction } from "@/server/actions/auth";

import { AuthField } from "./auth-field";
import { ActionErrorAlert } from "./form-alert";
import { useAuthForm } from "./use-auth-form";

/**
 * "Glemt password" (SPEC §6.4). Whatever the email, the answer is the same
 * note, so the page never reveals whether an account exists.
 */
export function ForgotPasswordForm({ next }: { next: string | null }) {
  const { state, formProps, fieldErrors, formError, values } = useAuthForm(
    requestPasswordResetAction,
    forgotPasswordSchema,
  );

  if (state?.ok) return <ResetLinkSent email={state.data.email} next={next} />;

  return (
    <form {...formProps} className="grid gap-5">
      {/* The reset link carries it on, so an invitation survives the detour (§6.5). */}
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {formError ? <ActionErrorAlert error={formError} /> : null}
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
      />
      <SubmitButton size="lg" className="w-full" pendingLabel="Sender link …">
        Send link
      </SubmitButton>
    </form>
  );
}

function ResetLinkSent({ email, next }: { email: string; next: string | null }) {
  return (
    <div role="status" className="grid gap-5">
      <div className="flex flex-col items-start gap-4 sm:flex-row">
        <span
          aria-hidden
          className="m-1.5 grid size-12 shrink-0 place-items-center porthole rounded-full bg-olive-tint text-olive-deep"
        >
          <MailCheckIcon className="size-6" />
        </span>
        <div className="grid min-w-0 gap-1.5">
          <h2 className="text-xl leading-tight font-bold text-olive">
            Hvis emailen findes, har vi sendt et link{"\u00a0"}📬
          </h2>
          <p className="text-muted-foreground">
            Tjek indbakken for{" "}
            <strong className="[overflow-wrap:anywhere] text-ink">{email}</strong> – og spam-mappen,
            hvis den gemmer sig. Linket virker i{"\u00a0"}1{"\u00a0"}time.
          </p>
        </div>
      </div>
      <Button asChild variant="outline" size="lg" className="w-full">
        <Link href={withNext("/login", next)}>Tilbage til log ind</Link>
      </Button>
    </div>
  );
}
