import type { Metadata } from "next";
import Link from "next/link";

import { FormAlert } from "@/components/features/auth/form-alert";
import { ResetPasswordForm } from "@/components/features/auth/reset-password-form";
import { TextLink } from "@/components/features/auth/text-link";
import { CenteredShell } from "@/components/features/centered-shell";
import { Button } from "@/components/ui/button";
import { firstParam, readNextParam, withNext } from "@/lib/auth-links";
import { isPasswordResetTokenValid } from "@/server/auth/reset-link";
import { isEmailDeliveryAvailable } from "@/server/email/send-email";

export const metadata: Metadata = {
  title: "Nyt password",
  // The token is in the URL: never send it on in a Referer header.
  referrer: "no-referrer",
};

function BackToLogin({ next }: { next: string | null }) {
  return (
    <TextLink href={withNext("/login", next)} className="inline-flex min-h-11 items-center">
      Tilbage til log ind
    </TextLink>
  );
}

/**
 * Nyt password from a one-time link (?token=…), sent by email or made by an
 * admin (SPEC §6.4). The token is checked up front, so an old link says so
 * before anyone types a new password.
 *
 * ?next= (only in email links requested from a page with ?next=, e.g. an
 * invitation, §6.5) is carried on to /login after the reset and on every link.
 */
export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const params = await searchParams;
  const token = firstParam(params.token);
  const next = readNextParam(params.next);

  if (!token || !(await isPasswordResetTokenValid(token))) {
    return <ExpiredLink next={next} />;
  }

  return (
    <CenteredShell
      title="Vælg et nyt password"
      subtitle={"Gerne et, du stadig kan huske efter tredje øl\u00a0🍺"}
      footer={<BackToLogin next={next} />}
    >
      <ResetPasswordForm token={token} next={next} />
    </CenteredShell>
  );
}

function ExpiredLink({ next }: { next: string | null }) {
  const emailAvailable = isEmailDeliveryAvailable();

  return (
    <CenteredShell
      title="Linket er udløbet eller allerede brugt"
      subtitle={"Et nulstillingslink virker kun én gang og i\u00a01\u00a0time."}
      footer={<BackToLogin next={next} />}
    >
      {emailAvailable ? (
        <div className="grid gap-5">
          <p className="text-muted-foreground">
            Bed om et nyt, så er du hurtigt tilbage ved bordet.
          </p>
          <Button asChild size="lg" className="w-full">
            <Link href={withNext("/forgot-password", next)}>Bed om et nyt link</Link>
          </Button>
        </div>
      ) : (
        <FormAlert tone="info">
          Kontakt en admin i din klub for at få et nyt nulstillingslink.
        </FormAlert>
      )}
    </CenteredShell>
  );
}
