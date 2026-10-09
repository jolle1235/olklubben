import Link from "next/link";
import { MapPinIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { getDisplayName, type DisplayNameUser } from "@/lib/format/display-name";
import { cn } from "@/lib/utils";

import { ownersLabel, tastingCountLabel } from "./place-labels";

/** What a card shows of a place (PlaceListItem fits). */
export type PlaceCardPlace = {
  name: string;
  address: string | null;
  /** Sorted by display name. */
  owners: readonly (DisplayNameUser & { id: string })[];
  eventCount: number;
};

export type PlaceCardProps = {
  place: PlaceCardPlace;
  href: string;
  /** The viewer owns it: "Dit sted". */
  isMine: boolean;
  /** Archived places are shown muted (inside "Arkiverede steder"). */
  muted?: boolean;
};

/**
 * One place in Steder (SPEC §9.4):
 *
 *   📍 Hos Mads                       [Dit sted]
 *      Søndergade 12, 8381 Tilst
 *      Ejer: Mads · 4 ølsmagninger
 *
 * The whole card is one link. User text wraps (F-028/F-047).
 */
export function PlaceCard({ place, href, isMine, muted = false }: PlaceCardProps) {
  const owners = ownersLabel(place.owners.map((owner) => getDisplayName(owner)));
  return (
    <Link
      href={href}
      className={cn(
        "group/place flex gap-3 rounded-xl border border-border px-4 py-3.5 transition-[border-color,box-shadow] hover:border-input hover:shadow-[0_10px_24px_-20px_rgb(65_68_55/0.7)] sm:gap-4 sm:px-5",
        muted ? "bg-paper/60" : "bg-paper",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 grid size-10 shrink-0 place-items-center rounded-full [&_svg]:size-5",
          muted ? "bg-cream-deep text-slate" : "bg-olive text-amber",
        )}
      >
        <MapPinIcon strokeWidth={2.25} />
      </span>
      <span className="grid min-w-0 flex-1 grid-cols-1 gap-1">
        <span className="flex items-start justify-between gap-3">
          <span
            className={cn(
              "min-w-0 font-heading text-lg leading-snug font-semibold break-words hyphens-auto group-hover/place:underline group-hover/place:decoration-amber group-hover/place:decoration-2 group-hover/place:underline-offset-4",
              muted ? "text-slate" : "text-olive",
            )}
          >
            {place.name}
          </span>
          {isMine ? (
            <Badge variant="amber" className="mt-0.5">
              Dit sted
            </Badge>
          ) : null}
        </span>
        {place.address ? (
          <span className="text-[0.95rem] break-words hyphens-auto text-ink">{place.address}</span>
        ) : null}
        <span className="text-[0.95rem] break-words hyphens-auto text-muted-foreground">
          {owners} · {tastingCountLabel(place.eventCount)}
        </span>
      </span>
    </Link>
  );
}
