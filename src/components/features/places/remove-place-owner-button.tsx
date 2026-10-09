"use client";

import { XIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { removePlaceOwnerAction } from "@/server/actions/places";

import { removeOwnerCopy } from "./place-labels";

export type RemovePlaceOwnerButtonProps = {
  clubId: string;
  placeId: string;
  placeName: string;
  ownerId: string;
  /** getDisplayName of the owner. */
  ownerName: string;
  /** After the owner is gone (the row and its button disappear): where focus goes. */
  onRemoved?: () => void;
};

/**
 * An admin's X next to ANOTHER owner (SPEC §5.1 note, D-100), with a
 * confirmation (§15.1). The action checks again (canRemovePlaceOwner) and
 * revalidates, so the list re-renders without the owner.
 */
export function RemovePlaceOwnerButton({
  clubId,
  placeId,
  placeName,
  ownerId,
  ownerName,
  onRemoved,
}: RemovePlaceOwnerButtonProps) {
  const copy = removeOwnerCopy(ownerName, placeName);
  return (
    <ConfirmDialog
      trigger={
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Fjern ${ownerName} som ejer`}
          className="text-slate hover:bg-danger-tint hover:text-danger"
        >
          <XIcon aria-hidden />
        </Button>
      }
      title={<span className="break-words hyphens-auto">{copy.title}</span>}
      description={copy.description}
      confirmLabel="Fjern som ejer"
      pendingLabel="Fjerner …"
      destructive
      onConfirm={() => removePlaceOwnerAction(clubId, placeId, ownerId)}
      onSuccess={() => {
        toast.success(`${ownerName} er ikke længere ejer.`);
        onRemoved?.();
      }}
    />
  );
}
