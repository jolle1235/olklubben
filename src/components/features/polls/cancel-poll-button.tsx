"use client";

import { BanIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cancelPollAction } from "@/server/actions/poll-lifecycle";

import { cancelConfirmCopy } from "./decision-labels";

export type CancelPollButtonProps = {
  clubId: string;
  pollId: string;
  title: string;
};

/**
 * "Annullér afstemning" with its confirmation (SPEC §9.7.4): no event is
 * created and the votes stay visible. Redirects to the poll with
 * "poll-cancelled"; a refusal or an error shows inside the dialog.
 */
export function CancelPollButton({ clubId, pollId, title }: CancelPollButtonProps) {
  const copy = cancelConfirmCopy(title);
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" className="text-danger hover:bg-danger-tint">
          <BanIcon aria-hidden />
          Annullér afstemning
        </Button>
      }
      title={<span className="break-words hyphens-auto">{copy.title}</span>}
      description={copy.description}
      confirmLabel={copy.confirmLabel}
      cancelLabel={copy.cancelLabel}
      pendingLabel={copy.pendingLabel}
      destructive
      onConfirm={() => cancelPollAction(clubId, pollId)}
    />
  );
}
