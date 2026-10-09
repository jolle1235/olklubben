import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";

import { ClubBadge } from "@/components/features/club-badge";
import { memberCountLabel } from "@/server/domain/clubs/members";
import { CLUB_ROLE_LABEL, type ClubRole } from "@/server/domain/clubs/permissions";

export type ClubPickerItem = {
  id: string;
  name: string;
  role: ClubRole;
  memberCount: number;
};

/**
 * The clubs on /clubs (SPEC §10.1, §10.3) as big tap targets. Opening a club
 * makes it the active club: the club's page remembers it (requireClubPage).
 * The default (auto) prefetch only renders the club layout, which never
 * writes, so a prefetch does not change the active club. Never set
 * prefetch={true} here.
 *
 * Long names (up to 60 characters, also a single word) wrap over at most three
 * lines; grid-cols-1 (minmax(0, 1fr)) keeps the row inside the card at 375 px.
 */
export function ClubPickerList({ clubs }: { clubs: ClubPickerItem[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3">
      {clubs.map((club) => (
        <li key={club.id}>
          <Link
            href={`/c/${club.id}`}
            className="group flex min-h-18 items-center gap-4 rounded-xl border border-border bg-paper px-4 py-3 transition-colors hover:border-input hover:bg-cream"
          >
            <ClubBadge name={club.name} className="m-1" />
            <span className="min-w-0 flex-1">
              <span className="line-clamp-3 font-display text-lg leading-snug font-semibold break-words hyphens-auto text-olive">
                {club.name}
              </span>
              <span className="block text-[0.95rem] text-muted-foreground">
                {CLUB_ROLE_LABEL[club.role]} · {memberCountLabel(club.memberCount)}
              </span>
            </span>
            <ChevronRightIcon
              aria-hidden
              className="size-5 shrink-0 text-slate transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
