import type { Metadata } from "next";
import Link from "next/link";
import { PencilIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { editPlaceHref, placesHref } from "@/lib/routes";
import { requirePlace, requirePlacePage } from "@/server/places/access";

export async function generateMetadata({
  params,
}: PageProps<"/c/[clubId]/places/[placeId]">): Promise<Metadata> {
  const { clubId, placeId } = await params;
  // Cached with the guard layout's call; never writes.
  const { place } = await requirePlace(clubId, placeId);
  return { title: place.name };
}

/**
 * One place (SPEC §9.4). The guard layout has already given a real 404 for a
 * place that is not in this club (E22); requirePlacePage() returns it with its
 * owners and remembers the active club.
 *
 * STUB (round-3 foundation): name, address and the way to edit it; agent B
 * replaces the body (owners and the owner toggle, "Opret event her", removal,
 * restore, "Ølsmagninger her").
 */
export default async function PlacePage({ params }: PageProps<"/c/[clubId]/places/[placeId]">) {
  const { clubId, placeId } = await params;
  const { club, place } = await requirePlacePage(clubId, placeId);

  return (
    <>
      <PageHeader
        title={place.name}
        description={place.address ?? undefined}
        action={
          <Button asChild variant="outline">
            <Link href={editPlaceHref(club.id, place.id)}>
              <PencilIcon aria-hidden />
              Rediger
            </Link>
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        {place.archivedAt ? <Badge variant="outline">Arkiveret</Badge> : null}
        <Button asChild variant="outline">
          <Link href={placesHref(club.id)}>Alle steder</Link>
        </Button>
      </div>
    </>
  );
}
