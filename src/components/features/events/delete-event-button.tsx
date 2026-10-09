"use client";

import { Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteEventAction } from "@/server/actions/events";

export type DeleteEventButtonProps = {
  clubId: string;
  eventId: string;
  title: string;
};

/**
 * "Slet event" with the confirmation from SPEC §9.2. On success the action
 * opens Overblik with a toast; a refusal or an error shows in the dialog.
 */
export function DeleteEventButton({ clubId, eventId, title }: DeleteEventButtonProps) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" className="text-danger hover:bg-danger-tint">
          <Trash2Icon aria-hidden />
          Slet event
        </Button>
      }
      title="Er du sikker?"
      description={
        <>
          <span className="block break-words hyphens-auto">
            &quot;{title}&quot; bliver slettet permanent.
          </span>
          <span className="mt-1 block">
            Øl, der er knyttet til eventet, bliver i kataloget, men mister koblingen.
          </span>
        </>
      }
      confirmLabel="Slet event"
      pendingLabel="Sletter …"
      destructive
      onConfirm={() => deleteEventAction(clubId, eventId)}
    />
  );
}
