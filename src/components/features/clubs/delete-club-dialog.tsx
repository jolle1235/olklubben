"use client";

import { useId, useState } from "react";
import { Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteClubAction } from "@/server/actions/clubs";
import { isClubNameConfirmed } from "@/server/domain/clubs/membership-rules";

import { deleteClubSummary, type ClubContentCounts } from "./club-labels";

export type DeleteClubDialogProps = {
  clubId: string;
  clubName: string;
  /** getClubContentCounts: shown in the confirmation (D-103), polls included (round 4). */
  counts: ClubContentCounts;
};

/**
 * Admin only: "Slet klubben" in the Farezone (SPEC §7.5, D-103). The
 * confirmation lists what goes, and the button stays disabled until the
 * club's name is typed (isClubNameConfirmed: case, spacing and NFC do not
 * matter). The server compares again with the name read under the club
 * lock, then sends everyone's browser home with a toast (D-104).
 */
export function DeleteClubDialog({ clubId, clubName, counts }: DeleteClubDialogProps) {
  const [typed, setTyped] = useState("");
  const inputId = useId();
  const hintId = `${inputId}-hint`;

  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6">
      <div className="min-w-0">
        <h3 className="font-heading text-lg leading-tight font-semibold text-ink">Slet klubben</h3>
        <p className="mt-1 text-[0.95rem] text-pretty text-muted-foreground">
          Sletter klubben og alt i den for alle medlemmer. Det kan ikke fortrydes.
        </p>
      </div>
      <ConfirmDialog
        trigger={
          <Button variant="destructive" className="w-full sm:w-auto">
            <Trash2Icon aria-hidden />
            Slet klubben
          </Button>
        }
        onOpenChange={(open) => {
          if (!open) setTyped("");
        }}
        title={<span className="break-words hyphens-auto">Slet {clubName}?</span>}
        description={deleteClubSummary(counts)}
        confirmLabel="Slet klubben"
        pendingLabel="Sletter …"
        destructive
        confirmDisabled={!isClubNameConfirmed(clubName, typed)}
        action={(formData) => deleteClubAction(clubId, formData)}
      >
        <div className="grid gap-2">
          <Label htmlFor={inputId}>Skriv klubbens navn for at bekræfte</Label>
          <Input
            id={inputId}
            name="confirmName"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={clubName}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-describedby={hintId}
          />
          <p id={hintId} className="text-[0.95rem] break-words hyphens-auto text-muted-foreground">
            Skriv <span className="font-semibold text-ink">{clubName}</span>
          </p>
        </div>
      </ConfirmDialog>
    </div>
  );
}
