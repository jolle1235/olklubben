import Link from "next/link";
import { ChevronRightIcon, MapPinIcon } from "lucide-react";

import { placesHref } from "@/lib/routes";

import { placeCountLabel } from "./club-labels";

/**
 * "Steder · N steder" on the club page (SPEC §9.8 "Steder (link)", §9.4):
 * the way to the club's places, which have no main navigation item (§8.1).
 */
export function ClubPlacesRow({ clubId, placeCount }: { clubId: string; placeCount: number }) {
  return (
    <Link
      href={placesHref(clubId)}
      className="group/row flex min-h-16 items-center gap-4 rounded-2xl border border-border bg-paper px-4 py-3 transition-colors hover:bg-cream-deep/70 sm:px-5"
    >
      <span
        aria-hidden
        className="grid size-10 shrink-0 place-items-center rounded-full bg-olive text-amber [&_svg]:size-5"
      >
        <MapPinIcon strokeWidth={2.25} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-heading text-lg leading-tight font-semibold text-olive">
          Steder
        </span>
        <span className="block text-[0.95rem] text-pretty text-muted-foreground">
          {placeCountLabel(placeCount)} · Hvor I mødes, og hvem der ejer dem
        </span>
      </span>
      <ChevronRightIcon
        aria-hidden
        className="size-5 shrink-0 text-slate transition-transform group-hover/row:translate-x-0.5"
      />
    </Link>
  );
}
