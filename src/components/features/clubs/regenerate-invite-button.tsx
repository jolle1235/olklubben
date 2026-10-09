"use client";

import { RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { regenerateInvite } from "@/server/actions/clubs";

/**
 * Admin only: [ Generér ny kode ] with a confirmation (SPEC §7.3). The server
 * checks the role again; hiding the button is only UX.
 * Without an active code (should not happen) the same action creates one.
 */
export function RegenerateInviteButton({
  clubId,
  hasInvite,
}: {
  clubId: string;
  hasInvite: boolean;
}) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant={hasInvite ? "outline" : "default"} className="w-full sm:w-auto">
          <RefreshCwIcon aria-hidden />
          {hasInvite ? "Generér ny kode" : "Lav en invitationskode"}
        </Button>
      }
      title={hasInvite ? "Generér en ny kode?" : "Lav en invitationskode?"}
      description={
        hasInvite
          ? "Den gamle kode og det gamle link holder op med at virke. Dem, der allerede er med, bliver i klubben."
          : "Klubben får en ny kode og et nyt link, som alle medlemmer kan dele."
      }
      confirmLabel={hasInvite ? "Generér ny kode" : "Lav kode"}
      pendingLabel="Genererer …"
      onConfirm={() => regenerateInvite(clubId)}
      onSuccess={() => toast.success("Ny kode klar. Del det nye link 🍻")}
    />
  );
}
