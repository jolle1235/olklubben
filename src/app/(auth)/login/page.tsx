import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FormAlert } from "@/components/features/auth/form-alert";
import { GoogleSignIn } from "@/components/features/auth/google-sign-in";
import { SignInForm } from "@/components/features/auth/sign-in-form";
import { TextLink } from "@/components/features/auth/text-link";
import { CenteredShell } from "@/components/features/centered-shell";
import { isGoogleConfigured } from "@/env";
import { getOAuthErrorMessage } from "@/lib/auth-errors";
import { afterAuthPath, firstParam, isInvitePath, readNextParam, withNext } from "@/lib/auth-links";
import { getSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Log ind" };

/**
 * Log ind (SPEC §6.3). ?next= (e.g. an invite link, §6.5) survives the trip,
 * ?error= shows a failed Google login, ?reset=1 confirms a new password.
 */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = readNextParam(params.next);

  // The proxy lets logged-in users through to /login; send them on.
  if (await getSession()) redirect(afterAuthPath(next));

  const oauthError = getOAuthErrorMessage(firstParam(params.error));
  const passwordWasReset = firstParam(params.reset) === "1";

  return (
    <CenteredShell
      title="Log ind"
      subtitle={
        isInvitePath(next)
          ? "Log ind, så fortsætter du direkte til invitationen\u00a0🍻"
          : "Velkommen tilbage – der er skænket op\u00a0🍺"
      }
      footer={
        <>
          Har du ikke en konto?{" "}
          <TextLink href={withNext("/signup", next)} className="inline-flex min-h-11 items-center">
            Opret en
          </TextLink>
        </>
      }
    >
      <div className="grid gap-6">
        {passwordWasReset ? (
          <FormAlert tone="success">Dit password er opdateret. Log ind med det nye.</FormAlert>
        ) : null}
        {oauthError ? <FormAlert>{oauthError}</FormAlert> : null}
        {isGoogleConfigured ? (
          <GoogleSignIn
            callbackURL={afterAuthPath(next)}
            errorCallbackURL={withNext("/login", next)}
          />
        ) : null}
        <SignInForm next={next} />
      </div>
    </CenteredShell>
  );
}
