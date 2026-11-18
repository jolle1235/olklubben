import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { getDisplayName, officialNameSuffix } from "@/lib/format/display-name";
import { cn } from "@/lib/utils";
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
};

export type MemberListProps = {
  clubId: string;
  clubName: string;
  /** Already sorted (sortMembers). */
  members: MemberListItem[];
  currentUserId: string;
};

/**
 * The club's members (SPEC §9.8, Q11, D-102, D-105): avatar, the display name,
 * "(dig)" and an Admin badge on the first line, and the official name on a
 * second line when a nickname is shown. Two lines at most (D-181).
 *
 * Admins come first (sortMembers); a heavier line sets them apart from the
 * rest of the members (D-163).
 *
 * Admins get a '⋯' menu per member (memberMenu: promote, demote, reset link,
 * remove), also on their own row ("Fjern min admin-rolle"). Members get none.
 */
export function MemberList({ clubId, clubName, members, currentUserId }: MemberListProps) {
  const roster: Roster = new Map(members.map((member) => [member.userId, member.role]));

  return (
    <ul className="divide-y divide-border rounded-2xl border border-border bg-card px-4 sm:px-5">
      {members.map((member, index) => {
        const lastAdmin = member.role === "ADMIN" && members[index + 1]?.role === "MEMBER";
        const displayName = getDisplayName(member);
        const officialName = officialNameSuffix(member);
        const isMe = member.userId === currentUserId;
        const menu = memberMenu(currentUserId, member.userId, roster);
        return (
          <li
            key={member.userId}
            className={cn(
              "flex min-h-14 items-center gap-3 py-2.5 sm:gap-4",
              lastAdmin && "border-b-2 border-primary-border",
            )}
          >
            <UserAvatar name={displayName} image={member.image} decorative className="m-1" />
            <div className="grid min-w-0 flex-1 grid-cols-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="min-w-0 font-semibold break-words hyphens-auto text-foreground">
                  {displayName}
                </span>{" "}
                {isMe ? <span className="text-muted-foreground">(dig)</span> : null}
                {member.role === "ADMIN" ? (
                  <Badge variant="secondary">{CLUB_ROLE_LABEL.ADMIN}</Badge>
                ) : null}
              </p>
              {officialName ? (
                <p className="text-body-sm break-words hyphens-auto text-muted-foreground">
                  ({officialName})
                </p>
              ) : null}
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
