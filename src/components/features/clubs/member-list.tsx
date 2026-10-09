import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { formatDate, toDateKey } from "@/lib/format/date";
import { getDisplayName } from "@/lib/format/display-name";
import { CLUB_ROLE_LABEL, type ClubRole } from "@/server/domain/clubs/permissions";

import { MemberResetLinkDialog } from "./member-reset-link-dialog";

export type MemberListItem = {
  userId: string;
  name: string;
  image: string | null;
  role: ClubRole;
  joinedAt: Date;
};

export type MemberListProps = {
  clubId: string;
  /** Already sorted (sortMembers). */
  members: MemberListItem[];
  currentUserId: string;
  /** canGeneratePasswordResetLink(membership): admins only. */
  canCreateResetLinks: boolean;
};

/**
 * The club's members (SPEC §9.8; round 1 is view only, Q11): avatar, name,
 * "(dig)", an Admin badge and "Medlem siden …". Admins also get a reset link
 * per other member (§6.4).
 */
export function MemberList({
  clubId,
  members,
  currentUserId,
  canCreateResetLinks,
}: MemberListProps) {
  return (
    <ul className="divide-y divide-border rounded-2xl border border-border bg-paper px-4 sm:px-5">
      {members.map((member) => {
        const displayName = getDisplayName(member);
        const isMe = member.userId === currentUserId;
        return (
          <li key={member.userId} className="flex min-h-18 items-center gap-3 py-3 sm:gap-4">
            <UserAvatar name={displayName} image={member.image} decorative className="m-1" />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="min-w-0 font-semibold break-words text-ink">{displayName}</span>
                {isMe ? <span className="text-muted-foreground">(dig)</span> : null}
                {member.role === "ADMIN" ? (
                  <Badge variant="secondary">{CLUB_ROLE_LABEL.ADMIN}</Badge>
                ) : null}
              </p>
              <p className="text-[0.95rem] text-muted-foreground">
                Medlem siden{" "}
                <time dateTime={toDateKey(member.joinedAt)}>{formatDate(member.joinedAt)}</time>
              </p>
            </div>
            {canCreateResetLinks && !isMe ? (
              <MemberResetLinkDialog clubId={clubId} userId={member.userId} name={displayName} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
