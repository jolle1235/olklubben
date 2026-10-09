import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClubInfoForm } from "@/components/features/clubs/club-info-form";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { rememberActiveClub, requireMembership } from "@/server/auth/session";
import { canEditClubInfo } from "@/server/domain/clubs/permissions";

export const metadata: Metadata = { title: "Rediger klubinfo" };

/**
 * Rediger klubinfo (SPEC §7.1, D-110): the club's name and description.
 *
 * Admins only; anyone else gets a real 404. No loading.tsx above this page
 * (TG-008, D-108), and the permission 404 comes before the active club
 * changes (D-066, D-089): requireMembership → canEditClubInfo →
 * rememberActiveClub. The Server Action checks again.
 */
export default async function EditClubPage({ params }: PageProps<"/c/[clubId]/club/edit">) {
  const { clubId } = await params;
  const { user, membership, club } = await requireMembership(clubId);
  if (!canEditClubInfo(membership)) notFound();
  await rememberActiveClub(user, club.id);

  return (
    <>
      <PageHeader
        title="Rediger klubinfo"
        description={<span className="break-words hyphens-auto">{club.name}</span>}
      />
      <Card className="max-w-2xl">
        <CardContent>
          <ClubInfoForm clubId={club.id} name={club.name} description={club.description} />
        </CardContent>
      </Card>
    </>
  );
}
