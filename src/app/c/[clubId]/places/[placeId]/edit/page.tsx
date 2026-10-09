import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PencilIcon } from "lucide-react";

import { ComingSoon } from "@/components/features/coming-soon";
import { Button } from "@/components/ui/button";
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
 *
 * STUB (round-3 foundation): the guard is final; agent B replaces the body
 * with PlaceForm.
 */
export default async function EditPlacePage({
  params,
}: PageProps<"/c/[clubId]/places/[placeId]/edit">) {
  const { clubId, placeId } = await params;
  const { user, membership, club, place } = await requirePlace(clubId, placeId);
  if (!canEditPlace(membership)) notFound();
  await rememberActiveClub(user, club.id);

  return (
    <ComingSoon
      title="Rediger sted"
      icon={<PencilIcon />}
      headline="Stedet kan snart rettes her"
      description={<span className="break-words hyphens-auto">{place.name}</span>}
      actions={
        <Button asChild variant="outline">
          <Link href={placeHref(club.id, place.id)}>Tilbage til stedet</Link>
        </Button>
      }
    />
  );
}
