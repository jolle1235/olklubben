import type { Metadata } from "next";
import Link from "next/link";
import { PencilIcon, UserPlusIcon } from "lucide-react";

import { TopBarAction } from "@/components/features/app-shell";
import { ClubPlacesRow } from "@/components/features/clubs/club-places-row";
import { DeleteClubDialog } from "@/components/features/clubs/delete-club-dialog";
import { InviteSection } from "@/components/features/clubs/invite-section";
import { LeaveClubSection } from "@/components/features/clubs/leave-club-section";
import { MemberList } from "@/components/features/clubs/member-list";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { SectionDivider } from "@/components/ui/section-divider";
import { inviteUrl } from "@/lib/app-url";
import { formatDate } from "@/lib/format/date";
import { editClubHref } from "@/lib/routes";
import { requireClubPage } from "@/server/auth/session";
import {
  countActivePlaces,
  getActiveInviteCode,
  getClubContentCounts,
  getClubMembers,
} from "@/server/clubs/queries";
import { formatInviteCode } from "@/server/domain/clubs/invite-code";
import { memberCountLabel, sortMembers } from "@/server/domain/clubs/members";
import { leaveBlock } from "@/server/domain/clubs/membership-rules";
import {
  canDeleteClub,
  canEditClubInfo,
  canRegenerateInvite,
} from "@/server/domain/clubs/permissions";

export const metadata: Metadata = { title: "Klubben" };

/**
 * Klubbens side (SPEC §9.8, §7.4, §7.5, Q11, D-163), in sections split by a
 * thin line: the members (admins first; admins get a '⋯' menu per member,
 * D-102), the club's places, the invitation card for everyone, and the Farezone: "Forlad klubben" for everyone (or why not) and
 * "Slet klubben" for admins (D-103). Admins edit the name and description on
 * /club/edit (D-110).
 *
 * Lives in the (members) route group (URL still /c/[clubId]/club) so its
 * loading.tsx does not wrap club/edit (D-108).
 */
export default async function ClubPage({ params }: PageProps<"/c/[clubId]/club">) {
  const { clubId } = await params;
  // Membership is cached per request (the layout checked it too); this also gives the role.
  const { user, membership, club } = await requireClubPage(clubId);
  const mayDelete = canDeleteClub(membership);

  const [members, inviteCode, placeCount, counts] = await Promise.all([
    getClubMembers(club.id),
    getActiveInviteCode(club.id),
    countActivePlaces(club.id),
    mayDelete ? getClubContentCounts(club.id) : null,
  ]);
  const roster = new Map(members.map((member) => [member.userId, member.role]));

  const inviteAction = (
    <a href="#invite" aria-label="Inviter medlemmer">
      <UserPlusIcon aria-hidden />
      <span className="max-md:sr-only">Inviter</span>
    </a>
  );

  return (
    <>
      <TopBarAction>
        <Button asChild size="icon" variant="brass">
          {inviteAction}
        </Button>
      </TopBarAction>

      <PageHeader
        title={club.name}
        description={
          <>
            {club.description ? (
              <span className="mb-1 block whitespace-pre-line text-ink">{club.description}</span>
            ) : null}
            <span className="block">
              {memberCountLabel(members.length)} · Oprettet {formatDate(club.createdAt)}
            </span>
          </>
        }
        action={
          <>
            {canEditClubInfo(membership) ? (
              <Button asChild variant="outline" className="max-md:w-full">
                <Link href={editClubHref(club.id)}>
                  <PencilIcon aria-hidden />
                  Rediger klubinfo
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" className="hidden md:inline-flex">
              {inviteAction}
            </Button>
          </>
        }
      />

      <section id="medlemmer" aria-labelledby="members-heading" className="scroll-mt-24">
        <h2 id="members-heading" className="mb-4 text-2xl text-olive">
          Medlemmer
        </h2>
        <MemberList
          clubId={club.id}
          clubName={club.name}
          members={sortMembers(members)}
          currentUserId={user.id}
        />
      </section>

      <SectionDivider className="my-8 md:my-10" />

      <section id="steder" aria-labelledby="places-heading" className="scroll-mt-24">
        <h2 id="places-heading" className="mb-4 text-2xl text-olive">
          Steder
        </h2>
        <ClubPlacesRow clubId={club.id} placeCount={placeCount} />
      </section>

      <SectionDivider className="my-8 md:my-10" />

      <InviteSection
        clubId={club.id}
        clubName={club.name}
        invite={
          inviteCode
            ? { url: inviteUrl(inviteCode), displayCode: formatInviteCode(inviteCode) }
            : null
        }
        canRegenerate={canRegenerateInvite(membership)}
      />

      <SectionDivider className="my-8 md:my-10" />

      <section aria-labelledby="danger-heading">
        <h2 id="danger-heading" className="mb-4 text-2xl text-olive">
          Farezone
        </h2>
        <div className="divide-y divide-border rounded-2xl border border-border bg-paper px-4 *:py-5 sm:px-5">
          <LeaveClubSection
            clubId={club.id}
            clubName={club.name}
            block={leaveBlock(user.id, roster)}
          />
          {mayDelete && counts ? (
            <DeleteClubDialog clubId={club.id} clubName={club.name} counts={counts} />
          ) : null}
        </div>
      </section>
    </>
  );
}
