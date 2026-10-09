"use client";

import { ArchiveIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { removePlaceAction } from "@/server/actions/places";
import type { PlaceRemoval } from "@/server/domain/places/permissions";

import { placeRemovalCopy } from "./place-labels";

export type RemovePlaceButtonProps = {
  clubId: string;
  placeId: string;
  placeName: string;
  /** placeRemoval(usage): what the server will do. */
  removal: PlaceRemoval;
  eventCount: number;
};

/**
 * The ONE removal button of a place (SPEC §9.4, D-100), labelled by what will
 * happen: "Slet sted" (unused → deleted) or "Arkivér sted" (used → archived),
 * with a confirmation that says so (§15.1). The server decides again under a
 * row lock; its redirect and toast follow what actually happened. A refusal
 * or an error shows in the dialog.
 */
export function RemovePlaceButton({
  clubId,
  placeId,
  placeName,
  removal,
  eventCount,
}: RemovePlaceButtonProps) {
  const copy = placeRemovalCopy(removal, eventCount);
  const Icon = removal === "delete" ? Trash2Icon : ArchiveIcon;
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" className="text-danger hover:bg-danger-tint">
          <Icon aria-hidden />
          {copy.label}
        </Button>
      }
      title={
        <span className="break-words hyphens-auto">
          {removal === "delete" ? "Slet" : "Arkivér"} «{placeName}»?
        </span>
      }
      description={copy.description}
      confirmLabel={copy.label}
      pendingLabel={copy.pendingLabel}
      destructive
      onConfirm={() => removePlaceAction(clubId, placeId)}
    />
  );
}
