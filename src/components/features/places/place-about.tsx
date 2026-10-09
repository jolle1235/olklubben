import Link from "next/link";
import { ExternalLinkIcon, MapPinIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { mapsSearchUrl } from "@/lib/routes";

export type PlaceAboutProps = {
  address: string | null;
  /** Line breaks are "\n". */
  description: string | null;
  /** "Tilføj adresse" goes here when there is no address. */
  editHref: string;
};

/**
 * Address with "Åbn i kort" (a Google Maps search on the address only, D-101;
 * without an address a "Tilføj adresse" link instead) and the description,
 * line breaks kept. Plain text: React escapes it (never HTML).
 */
export function PlaceAbout({ address, description, editHref }: PlaceAboutProps) {
  const mapsUrl = address ? mapsSearchUrl(address) : null;

  return (
    <section aria-label="Om stedet" className="grid grid-cols-1 gap-4">
      {address ? (
        <div className="grid grid-cols-1 gap-3">
          <p className="flex items-start gap-2 text-lg text-ink">
            <MapPinIcon aria-hidden className="mt-1 size-5 shrink-0 text-olive" />
            <span className="sr-only">Adresse: </span>
            <span className="min-w-0 break-words hyphens-auto">{address}</span>
          </p>
          {mapsUrl ? (
            <Button asChild variant="outline" className="justify-self-start">
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                Åbn i kort
                <ExternalLinkIcon aria-hidden />
                <span className="sr-only">(åbner i en ny fane)</span>
              </a>
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="flex flex-wrap items-center gap-x-3 text-muted-foreground">
          Ingen adresse endnu.
          <Link
            href={editHref}
            className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-primary underline decoration-2 underline-offset-4 hover:decoration-amber"
          >
            <PlusIcon aria-hidden className="size-4" />
            Tilføj adresse
          </Link>
        </p>
      )}

      {description ? (
        <p className="max-w-[60ch] text-[1.05rem] leading-relaxed break-words hyphens-auto whitespace-pre-line text-ink">
          {description}
        </p>
      ) : null}
    </section>
  );
}
