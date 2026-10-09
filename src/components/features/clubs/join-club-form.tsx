"use client";

import { useActionState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { joinClub } from "@/server/actions/clubs";
import { INVITE_NOT_WORKING_CODE } from "@/server/domain/clubs/invites";

/**
 * [ Join klub ] on the join confirmation (SPEC §10.7). The server re-checks
 * the code and takes the club from it, then redirects to the club's Overblik.
 * If the code was replaced in the meantime (E18), the button gives way to
 * "Skriv en anden kode".
 */
export function JoinClubForm({ code }: { code: string }) {
  const [state, formAction] = useActionState(joinClub, null);
  const failure = state && !state.ok ? state.error : null;
  const codeStopped = failure?.code === INVITE_NOT_WORKING_CODE;

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="code" value={code} />
      {failure ? <FormError>{failure.message}</FormError> : null}
      {codeStopped ? (
        <Button asChild size="lg">
          <Link href="/onboarding">Skriv en anden kode</Link>
        </Button>
      ) : (
        <SubmitButton size="lg" pendingLabel="Joiner klubben …">
          Join klub
        </SubmitButton>
      )}
    </form>
  );
}
