import type { Metadata } from "next";
import Link from "next/link";
import { MapPinIcon } from "lucide-react";

import { ComingSoon } from "@/components/features/coming-soon";
import { Button } from "@/components/ui/button";
import { placesHref } from "@/lib/routes";
import { requireClubPage } from "@/server/auth/session";

export const metadata: Metadata = { title: "Nyt sted" };

/**
 * Nyt sted (SPEC §9.4): name, address, description and "Det er mit sted".
 * Every member may create a place (canCreatePlace).
 *
 * Never calls notFound() itself, so loading.tsx may sit next to it (TG-008).
 *
 * STUB (round-3 foundation): agent B replaces the body with PlaceForm.
 */
export default async function NewPlacePage({ params }: PageProps<"/c/[clubId]/places/new">) {
  const { clubId } = await params;
  const { club } = await requireClubPage(clubId);

  return (
    <ComingSoon
      title="Nyt sted"
      icon={<MapPinIcon />}
      headline="Snart kan I oprette steder her 📍"
      actions={
        <Button asChild variant="outline">
          <Link href={placesHref(club.id)}>Til stederne</Link>
        </Button>
      }
    />
  );
}
