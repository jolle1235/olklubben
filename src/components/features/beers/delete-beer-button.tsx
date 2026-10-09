"use client";

import { Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteBeerAction } from "@/server/actions/beers";

import { deleteBeerDescription } from "./catalog-view";

export type DeleteBeerButtonProps = {
  clubId: string;
  beerId: string;
  beerName: string;
  /** How many ratings go with it (E14), shown in the confirmation. */
  ratingCount: number;
};

/**
 * "Slet øl" with a confirmation that says how many ratings go with it (SPEC
 * §15.1, E14). Creator or admin only (the page hides it for others; the
 * action checks again). On success the action opens the catalogue with a
 * toast (`?toast=beer-deleted`); a refusal or an error shows in the dialog.
 */
export function DeleteBeerButton({ clubId, beerId, beerName, ratingCount }: DeleteBeerButtonProps) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" className="text-danger hover:bg-danger-tint">
          <Trash2Icon aria-hidden />
          Slet øl
        </Button>
      }
      title={<span className="break-words hyphens-auto">Slet {beerName}?</span>}
      description={deleteBeerDescription(ratingCount)}
      confirmLabel="Slet øl"
      pendingLabel="Sletter …"
      destructive
      onConfirm={() => deleteBeerAction(clubId, beerId)}
    />
  );
}
