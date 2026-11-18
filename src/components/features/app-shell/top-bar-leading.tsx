"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";

import { useSongbookHref } from "@/components/features/songs/back-to-songbook";
import { isClubSubpage, isSongPage, parentPage } from "@/lib/nav-history";
import { overviewHref } from "@/lib/routes";

import { ClubSwitcher, type ClubSummary } from "./club-switcher";
import { useBackHref } from "./use-back-href";

/**
 * The top bar's left side (D-182): the club switcher on a main page,
 * "‹ Tilbage" on a subpage (event, beer, place, poll, song, form, 404).
 * A song goes back to the songbook with its search, as "‹ Sangbog" does.
 */
export function TopBarLeading({ club, clubs }: { club: ClubSummary; clubs: ClubSummary[] }) {
  const pathname = usePathname();
  const clubPath = overviewHref(club.id);
  const history = useBackHref(pathname, clubPath, parentPage(pathname, clubPath));
  const songbook = useSongbookHref(club.id);

  if (!isClubSubpage(pathname)) {
    return <ClubSwitcher club={club} clubs={clubs} variant="topbar" className="min-w-0" />;
  }

  return (
    <Link
      href={isSongPage(pathname) ? songbook : history}
      className="flex min-h-11 shrink-0 items-center gap-0.5 rounded-xl pr-2.5 pl-1 font-semibold text-frame-foreground pressable-dim"
    >
      <ChevronLeftIcon aria-hidden className="size-6" />
      Tilbage
    </Link>
  );
}
