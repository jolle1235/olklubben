import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PencilIcon } from "lucide-react";

import { ComingSoon } from "@/components/features/coming-soon";
import { Button } from "@/components/ui/button";
import { clubHref } from "@/lib/routes";
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
 *
 * STUB (round-3 foundation): the guard is final; agent A replaces the body
 * with ClubInfoForm.
 */
export default async function EditClubPage({ params }: PageProps<"/c/[clubId]/club/edit">) {
  const { clubId } = await params;
  const { user, membership, club } = await requireMembership(clubId);
  if (!canEditClubInfo(membership)) notFound();
  await rememberActiveClub(user, club.id);

  return (
    <ComingSoon
      title="Rediger klubinfo"
      icon={<PencilIcon />}
      headline="Klubinfo kan snart rettes her"
      description={<span className="break-words hyphens-auto">{club.name}</span>}
      actions={
        <Button asChild variant="outline">
          <Link href={clubHref(club.id)}>Tilbage til klubben</Link>
        </Button>
      }
    />
  );
}
