"use client";

import { FlagIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { closePollAction } from "@/server/actions/poll-lifecycle";

import { closeConfirmCopy } from "./decision-labels";

export type ClosePollButtonProps = {
  clubId: string;
  pollId: string;
  /** For the confirmation: "6 af 8 har stemt." */
  votedCount: number;
  memberCount: number;
};

/**
 * "Afslut afstemning nu" with its confirmation (SPEC §9.7.5 "Manuelt"). The
 * action counts the votes and redirects to the poll ("poll-closed" or
 * "poll-awaiting"); a refusal or an error shows inside the dialog.
 */
export function ClosePollButton({ clubId, pollId, votedCount, memberCount }: ClosePollButtonProps) {
  const copy = closeConfirmCopy(votedCount, memberCount);
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline">
          <FlagIcon aria-hidden />
          Afslut afstemning nu
        </Button>
      }
      title={copy.title}
      description={copy.description}
      confirmLabel={copy.confirmLabel}
      cancelLabel={copy.cancelLabel}
      pendingLabel={copy.pendingLabel}
      onConfirm={() => closePollAction(clubId, pollId)}
    />
  );
}
