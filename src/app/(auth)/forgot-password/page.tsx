import type { Metadata } from "next";
import Link from "next/link";

import { FormAlert } from "@/components/features/auth/form-alert";
import { ForgotPasswordForm } from "@/components/features/auth/forgot-password-form";
import { TextLink } from "@/components/features/auth/text-link";
import { CenteredShell } from "@/components/features/centered-shell";
import { Button } from "@/components/ui/button";
import { externalProvider } from "@/env";
import { EXTERNAL_PROVIDERS } from "@/lib/auth-providers";
import { AUTH_ERROR_MESSAGES } from "@/lib/auth-errors";
import { readNextParam, withNext } from "@/lib/auth-links";
import { isEmailDeliveryAvailable } from "@/server/email/send-email";

export const metadata: Metadata = { title: "Glemt password" };

/**
 * Glemt password (SPEC §6.4, D-017, D-024). Without email delivery
 * (production without SMTP) there is no form: an admin makes a one-time link.
 */
export default async function ForgotPasswordPage({ searchParams }: PageProps<"/forgot-password">) {
  const next = readNextParam((await searchParams).next);
  const loginHref = withNext("/login", next);
  const emailAvailable = isEmailDeliveryAvailable();

  return (
    <CenteredShell
      title="Glemt password"
      subtitle={
        emailAvailable
          ? "Det sker for de bedste. Skriv din email, så sender vi et link til at vælge et nyt."
          : "Det sker for de bedste. En admin i klubben kan hjælpe dig videre."
      }
      footer={
        <>
          Kom du i tanke om det?{" "}
          <TextLink href={loginHref} className="inline-flex min-h-11 items-center">
            Log ind
          </TextLink>
        </>
      }
    >
      {emailAvailable ? (
        <ForgotPasswordForm next={next} />
      ) : (
        <div className="grid gap-5">
          <FormAlert tone="info">{AUTH_ERROR_MESSAGES.resetUnavailable}</FormAlert>
          <p className="text-muted-foreground">
            Admins kan lave et engangslink til dig fra klubbens medlemsliste. Det virker i 1 time og
            kan fx deles i gruppechatten.
            {externalProvider
              ? ` Logger du ind med ${EXTERNAL_PROVIDERS[externalProvider].label}, behøver du slet ikke et password.`
              : null}
          </p>
          <Button asChild variant="outline" size="lg" className="w-full">
            <Link href={loginHref}>Tilbage til log ind</Link>
          </Button>
        </div>
      )}
    </CenteredShell>
  );
}
