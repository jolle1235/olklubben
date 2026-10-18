"use client";

import { Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteFeedbackAction } from "@/server/actions/feedback";

/**
 * "Slet rapport" on a report's page (SPEC §9.9): its author while it is Ny,
 * or an app-admin (canDeleteFeedback; the action checks again). Confirmed
 * first (§15.1). On success the action opens the list with "Rapporten er
 * slettet."; a refusal ("ikke længere ny") or an error shows in the dialog.
 */
export function DeleteFeedbackButton({ feedbackId }: { feedbackId: string }) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" className="text-danger hover:bg-danger-tint">
          <Trash2Icon aria-hidden />
          Slet rapport
        </Button>
      }
      title="Slet rapporten?"
      description="Rapporten og dens 👍 slettes. Det kan ikke fortrydes."
      confirmLabel="Slet rapport"
      pendingLabel="Sletter …"
      cancelLabel="Behold den"
      destructive
      onConfirm={() => deleteFeedbackAction(feedbackId)}
    />
  );
}
