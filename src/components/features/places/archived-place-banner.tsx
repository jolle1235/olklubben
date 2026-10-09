import { ArchiveIcon } from "lucide-react";

import { RestorePlaceButton } from "./restore-place-button";

export type ArchivedPlaceBannerProps = {
  clubId: string;
  placeId: string;
  /** canRestorePlace: owners and admins get "Gendan sted" (the page's primary action). */
  canRestore: boolean;
};

/**
 * The banner on an archived place (SPEC §9.4, D-100): it is not offered when
 * choosing a place, but its events still show it.
 */
export function ArchivedPlaceBanner({ clubId, placeId, canRestore }: ArchivedPlaceBannerProps) {
  return (
    <section
      aria-labelledby="archived-place-heading"
      className="grid grid-cols-1 gap-3 rounded-2xl border border-amber bg-amber-tint px-4 py-4 sm:px-5"
    >
      <div className="flex items-start gap-3">
        <ArchiveIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-amber-ink" />
        <div className="grid min-w-0 gap-1">
          <h2 id="archived-place-heading" className="font-heading text-lg leading-snug text-ink">
            Arkiveret · vises ikke, når I vælger sted
          </h2>
          <p className="text-[0.95rem] text-ink">
            {canRestore
              ? "De gamle events viser det stadig. Gendan det, hvis I skal bruge det igen."
              : "De gamle events viser det stadig. Stedets ejere og klubbens admins kan gendanne det."}
          </p>
        </div>
      </div>
      {canRestore ? <RestorePlaceButton clubId={clubId} placeId={placeId} /> : null}
    </section>
  );
}
