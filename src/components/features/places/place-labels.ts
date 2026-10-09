import { formatDanishList } from "@/lib/format/list";
import type { PlaceRemoval } from "@/server/domain/places/permissions";

/**
 * Texts for the place pages (SPEC §9.4, D-100). Pure and client-safe, so the
 * Server Components and the confirm dialogs say the same thing.
 */

/** "Ingen ejere" · "Ejer: Mads" · "Ejere: Mads og Anders" (display names, already sorted). */
export function ownersLabel(ownerNames: readonly string[]): string {
  if (ownerNames.length === 0) return "Ingen ejere";
  return `${ownerNames.length === 1 ? "Ejer" : "Ejere"}: ${formatDanishList(ownerNames)}`;
}

/** "Ikke brugt endnu" · "1 ølsmagning" · "4 ølsmagninger" (the events at the place). */
export function tastingCountLabel(count: number): string {
  if (count <= 0) return "Ikke brugt endnu";
  return count === 1 ? "1 ølsmagning" : `${count} ølsmagninger`;
}

/** "1 ølsmagning" · "4 ølsmagninger", for running text ("brugt til …"). */
function tastings(count: number): string {
  return count === 1 ? "1 ølsmagning" : `${count} ølsmagninger`;
}

export type PlaceRemovalCopy = {
  /** The button and the confirm button. */
  label: string;
  /** The confirm dialog's text. */
  description: string;
  pendingLabel: string;
};

/**
 * The one removal button (D-100), labelled by what the server will do:
 * an unused place is deleted, a used one archived (§9.4).
 */
export function placeRemovalCopy(removal: PlaceRemoval, eventCount: number): PlaceRemovalCopy {
  if (removal === "delete") {
    return {
      label: "Slet sted",
      description: "Stedet er ikke brugt til nogen ølsmagninger, så det bliver slettet helt.",
      pendingLabel: "Sletter …",
    };
  }
  return {
    label: "Arkivér sted",
    description:
      `Stedet er brugt til ${tastings(eventCount)}, så det bliver ikke slettet. ` +
      "Det forsvinder fra listen, når I vælger sted, men de gamle events viser det stadig.",
    pendingLabel: "Arkiverer …",
  };
}

/** The confirm dialog when an admin removes another owner. */
export function removeOwnerCopy(ownerName: string, placeName: string) {
  return {
    title: `Fjern ${ownerName} som ejer af «${placeName}»?`,
    description: `${ownerName} bliver ikke længere foreslået som vært her.`,
  };
}
