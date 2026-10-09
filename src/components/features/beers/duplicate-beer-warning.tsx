import Link from "next/link";

import { beerHref } from "@/lib/routes";
import { formatAbv } from "@/server/domain/beers/abv";

export type DuplicateBeerWarningProps = {
  id: string;
  /** The club's beers with the same name (newest last). */
  beers: { id: string; name: string; abv: number }[];
  /** The club the beers belong to (links via beerHref, D-076). */
  clubId: string;
  /** "tilføje" (new beer) or "gemme" (edit). */
  verb: "tilføje" | "gemme";
};

/**
 * "Den her har I vist smagt før 👀" (SPEC §9.5, E21): links to the beer(s)
 * with the same name. Only a warning – the member can still add the beer.
 * Ink (13,34:1) and olive (7,86:1) on amber-tint.
 */
export function DuplicateBeerWarning({ id, beers, clubId, verb }: DuplicateBeerWarningProps) {
  return (
    <div id={id} className="rounded-xl border border-amber bg-amber-tint/70 px-4 py-3 text-ink">
      <p className="font-semibold">Den her har I vist smagt før 👀</p>
      <ul className="mt-1 grid grid-cols-1 gap-0.5">
        {beers.map((beer) => (
          <li key={beer.id} className="break-words hyphens-auto">
            <Link
              href={beerHref(clubId, beer.id)}
              className="inline-flex min-h-11 items-center font-semibold text-olive underline decoration-amber-ink decoration-2 underline-offset-4 hover:decoration-olive sm:min-h-8"
            >
              {beer.name}
            </Link>{" "}
            <span className="text-[0.95rem] text-slate">· {formatAbv(beer.abv)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[0.95rem]">Er det en anden øl, kan du godt {verb} den alligevel.</p>
    </div>
  );
}
