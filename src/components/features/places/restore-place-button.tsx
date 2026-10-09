"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArchiveRestoreIcon } from "lucide-react";

import { FormError } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { placeHref } from "@/lib/routes";
import { restorePlaceAction, type RestorePlaceState } from "@/server/actions/places";

export type RestorePlaceButtonProps = {
  clubId: string;
  placeId: string;
};

/**
 * "Gendan sted" (owner or admin, D-100): a one-button form, so it works
 * without JavaScript too. Success redirects to the place with a toast. When
 * an active place has taken the name meanwhile, the refusal links to it.
 */
export function RestorePlaceButton({ clubId, placeId }: RestorePlaceButtonProps) {
  const [state, formAction] = useActionState<RestorePlaceState>(
    restorePlaceAction.bind(null, clubId, placeId),
    null,
  );

  return (
    <form action={formAction} className="grid grid-cols-1 justify-items-start gap-3">
      <SubmitButton pendingLabel="Gendanner …">
        <ArchiveRestoreIcon aria-hidden />
        Gendan sted
      </SubmitButton>
      {state && !state.ok ? (
        <FormError className="w-full">
          <span className="break-words hyphens-auto">{state.error.message}</span>
          {state.existing ? (
            <>
              {" "}
              <Link
                href={placeHref(clubId, state.existing.id)}
                className="break-words hyphens-auto underline decoration-2 underline-offset-4"
              >
                Gå til «{state.existing.name}»
              </Link>
            </>
          ) : null}
        </FormError>
      ) : null}
    </form>
  );
}
