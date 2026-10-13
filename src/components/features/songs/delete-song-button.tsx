"use client";

import { Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteSongAction } from "@/server/actions/songs";

export type DeleteSongButtonProps = {
  clubId: string;
  songId: string;
  title: string;
};

/**
 * "Slet sang" at the bottom of the reader (admins, SPEC §9.6, D-080: delete
 * only from the song's own page). On success the action opens the songbook
 * with a toast; a refusal or an error shows in the dialog.
 */
export function DeleteSongButton({ clubId, songId, title }: DeleteSongButtonProps) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" className="text-danger hover:bg-danger-tint">
          <Trash2Icon aria-hidden />
          Slet sang
        </Button>
      }
      title={<span className="break-words hyphens-auto">Slet «{title}»?</span>}
      description="Sangen forsvinder fra sangbogen for alle i klubben. Det kan ikke fortrydes."
      confirmLabel="Slet sang"
      pendingLabel="Sletter …"
      cancelLabel="Behold den"
      destructive
      onConfirm={() => deleteSongAction(clubId, songId)}
    />
  );
}
