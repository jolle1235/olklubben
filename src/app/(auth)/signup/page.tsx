import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ExternalSignIn } from "@/components/features/auth/external-sign-in";
import { SignUpForm } from "@/components/features/auth/sign-up-form";
import { TextLink } from "@/components/features/auth/text-link";
import { CenteredShell } from "@/components/features/centered-shell";
import { externalProvider } from "@/env";
import { afterAuthPath, isInvitePath, readNextParam, withNext } from "@/lib/auth-links";
import { getSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Opret konto" };

/** Opret konto (SPEC §6.1). The new user is logged in and sent to ?next= or "/". */
export default async function SignUpPage({ searchParams }: PageProps<"/signup">) {
  const next = readNextParam((await searchParams).next);

  // The proxy lets logged-in users through to /signup; send them on.
  if (await getSession()) redirect(afterAuthPath(next));

  return (
    <CenteredShell
      title="Opret konto"
      subtitle={
        isInvitePath(next)
          ? "Opret en konto, så fortsætter du direkte til invitationen\u00a0🍻"
          : "Et halvt minut, så er du med. Hurtigere end at skænke en pilsner\u00a0🍺"
      }
      footer={
        <>
          Har du allerede en konto?{" "}
          <TextLink href={withNext("/login", next)} className="inline-flex min-h-11 items-center">
            Log ind
          </TextLink>
        </>
      }
    >
      <div className="grid gap-6">
        {externalProvider ? (
          <ExternalSignIn
            provider={externalProvider}
            callbackURL={afterAuthPath(next)}
            errorCallbackURL={withNext("/login", next)}
          />
        ) : null}
        <SignUpForm next={next} />
      </div>
    </CenteredShell>
  );
}
