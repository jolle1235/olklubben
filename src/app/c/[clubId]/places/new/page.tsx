import type { Metadata } from "next";

import { PlaceForm } from "@/components/features/places/place-form";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { placesHref } from "@/lib/routes";
import { requireClubPage } from "@/server/auth/session";

export const metadata: Metadata = { title: "Nyt sted" };

/**
 * Nyt sted (SPEC §9.4): name, address, description and "Det er mit sted".
 * Every member may create a place (canCreatePlace; the action checks again).
 *
 * Never calls notFound() itself, so loading.tsx may sit next to it (TG-008).
 */
export default async function NewPlacePage({ params }: PageProps<"/c/[clubId]/places/new">) {
  const { clubId } = await params;
  const { club } = await requireClubPage(clubId);

  return (
    <>
      <PageHeader
        title="Nyt sted"
        description="Hvor mødes I? Med en adresse virker 'Åbn i kort' på jeres events."
      />
      <Card className="max-w-2xl">
        <CardContent>
          <PlaceForm
            clubId={club.id}
            defaults={{ name: "", address: "", description: "" }}
            cancelHref={placesHref(club.id)}
          />
        </CardContent>
      </Card>
    </>
  );
}
