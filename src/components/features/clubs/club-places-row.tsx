import { MapPinIcon } from "lucide-react";

import { LinkRow } from "@/components/features/link-row";
import { placesHref } from "@/lib/routes";

import { placeCountLabel } from "./club-labels";

/**
 * "N steder" under the club page's "Steder" heading (SPEC §9.8, §9.4, D-163):
 * the way to the club's places, which have no main navigation item (§8.1).
 */
export function ClubPlacesRow({ clubId, placeCount }: { clubId: string; placeCount: number }) {
  return (
    <LinkRow
      href={placesHref(clubId)}
      icon={MapPinIcon}
      title={placeCountLabel(placeCount)}
      subtitle="Hvor I mødes, og hvem der ejer dem"
      className="pressable rounded-2xl border border-border bg-card sm:px-5"
    />
  );
}
