import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PlaceForm } from "@/components/features/places/place-form";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { placeHref } from "@/lib/routes";
import { rememberActiveClub } from "@/server/auth/session";
import { canEditPlace } from "@/server/domain/places/permissions";
import { requirePlace } from "@/server/places/access";

export const metadata: Metadata = { title: "Rediger sted" };

/**
 * Rediger sted (SPEC §9.4, D-100): every member may edit a place's name,
 * address and description, archived places too.
 *
 * No loading.tsx above this page (TG-008, D-108). The guard layout has already
 * checked that the place is in this club; the order is requirePlace →
 * canEditPlace → rememberActiveClub (D-066, D-089), so a permission 404 never
 * changes the active club. The Server Action checks again.
 */
export default async function EditPlacePage({
  params,
}: PageProps<"/c/[clubId]/places/[placeId]/edit">) {
  const { clubId, placeId } = await params;
  const { user, membership, club, place } = await requirePlace(clubId, placeId);
  if (!canEditPlace(membership)) notFound();
  await rememberActiveClub(user, club.id);

  return (
    <>
      <PageHeader
        title="Rediger sted"
        description={<span className="break-words hyphens-auto">{place.name}</span>}
      />
      <Card className="max-w-2xl">
        <CardContent>
          <PlaceForm
            clubId={club.id}
            placeId={place.id}
            defaults={{
              name: place.name,
              address: place.address ?? "",
              description: place.description ?? "",
            }}
            cancelHref={placeHref(club.id, place.id)}
          />
        </CardContent>
      </Card>
    </>
  );
}
