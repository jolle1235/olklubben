import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { formatDate, toDateKey } from "@/lib/format/date";
import { getDisplayName, officialNameSuffix } from "@/lib/format/display-name";
import { memberMenu, type Roster } from "@/server/domain/clubs/membership-rules";
import { CLUB_ROLE_LABEL, type ClubRole } from "@/server/domain/clubs/permissions";

import { MemberActionsMenu } from "./member-actions-menu";

export type MemberListItem = {
  userId: string;
  /** The official name. */
  name: string;
  nickname: string | null;
  image: string | null;
  role: ClubRole;
  joinedAt: Date;
};

export type MemberListProps = {
  clubId: string;
  clubName: string;
  /** Already sorted (sortMembers). */
  members: MemberListItem[];
  currentUserId: string;
};

/**
 * The club's members (SPEC §9.8, Q11, D-102, D-105): avatar, the display name
 * with the official name after it when a nickname is shown ("Kaptajnen
 * (Jesper Thomsen)"), "(dig)", an Admin badge and "Medlem siden …".
 *
 * Admins get a '⋯' menu per member (memberMenu: promote, demote, reset link,
 * remove), also on their own row ("Fjern min admin-rolle"). Members get none.
 */
export function MemberList({ clubId, clubName, members, currentUserId }: MemberListProps) {
  const roster: Roster = new Map(members.map((member) => [member.userId, member.role]));

  return (
    <ul className="divide-y divide-border rounded-2xl border border-border bg-paper px-4 sm:px-5">
      {members.map((member) => {
        const displayName = getDisplayName(member);
        const officialName = officialNameSuffix(member);
        const isMe = member.userId === currentUserId;
        const menu = memberMenu(currentUserId, member.userId, roster);
        return (
          <li key={member.userId} className="flex min-h-18 items-center gap-3 py-3 sm:gap-4">
            <UserAvatar name={displayName} image={member.image} decorative className="m-1" />
            <div className="grid min-w-0 flex-1 grid-cols-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="min-w-0 font-semibold break-words hyphens-auto text-ink">
                  {displayName}
                </span>{" "}
                {officialName ? (
                  <>
                    <span className="min-w-0 break-words hyphens-auto text-muted-foreground">
                      ({officialName})
                    </span>{" "}
                  </>
                ) : null}
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
            {menu ? (
              <MemberActionsMenu
                clubId={clubId}
                clubName={clubName}
                userId={member.userId}
                name={displayName}
                menu={menu}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
