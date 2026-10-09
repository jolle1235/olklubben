import type { Metadata } from "next";
import { UserPlusIcon } from "lucide-react";

import { TopBarAction } from "@/components/features/app-shell";
import { InviteSection } from "@/components/features/clubs/invite-section";
import { MemberList } from "@/components/features/clubs/member-list";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { RopeDivider } from "@/components/ui/rope-divider";
import { inviteUrl } from "@/lib/app-url";
import { formatDate } from "@/lib/format/date";
import { requireClubPage } from "@/server/auth/session";
import { getActiveInviteCode, getClubMembers } from "@/server/clubs/queries";
import { formatInviteCode } from "@/server/domain/clubs/invite-code";
import { memberCountLabel, sortMembers } from "@/server/domain/clubs/members";
import {
  canGeneratePasswordResetLink,
  canRegenerateInvite,
} from "@/server/domain/clubs/permissions";

export const metadata: Metadata = { title: "Klubben" };

/**
 * Klubbens side, round 1 (SPEC §9.8, §16.3, Q11): members (view only), the
 * invitation link for everyone, a new code and reset links for admins.
 * Removing members, roles, leaving and deleting the club come in round 3.
 *
 * Lives in the (members) route group (URL still /c/[clubId]/club) so its
 * loading.tsx does not wrap club/edit (D-108).
 */
export default async function ClubPage({ params }: PageProps<"/c/[clubId]/club">) {
  const { clubId } = await params;
  // Membership is cached per request (the layout checked it too); this also gives the role.
  const { user, membership, club } = await requireClubPage(clubId);

  const [members, inviteCode] = await Promise.all([
    getClubMembers(club.id),
    getActiveInviteCode(club.id),
  ]);

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
              <span className="mb-1 block text-ink">{club.description}</span>
            ) : null}
            <span className="block">
              {memberCountLabel(members.length)} · Oprettet {formatDate(club.createdAt)}
            </span>
          </>
        }
        action={
          <Button asChild variant="outline" className="hidden md:inline-flex">
            {inviteAction}
          </Button>
        }
      />

      <section aria-labelledby="members-heading">
        <h2 id="members-heading" className="mb-4 text-2xl text-olive">
          Medlemmer
        </h2>
        <MemberList
          clubId={club.id}
          members={sortMembers(members)}
          currentUserId={user.id}
          canCreateResetLinks={canGeneratePasswordResetLink(membership)}
        />
      </section>

      <RopeDivider className="my-8 md:my-10" />

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
    </>
  );
}
