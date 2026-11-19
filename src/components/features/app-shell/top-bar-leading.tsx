"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";

import { useSongbookHref } from "@/components/features/songs/back-to-songbook";
import { isSongPage, parentPage } from "@/lib/nav-history";
import { overviewHref } from "@/lib/routes";

import { useBackHref } from "./use-back-href";

/**
 * "‹ Tilbage" at the top bar's left (D-182). The bar is only on subpages
 * (D-183). A song goes back to the songbook with its search, as "‹ Sangbog" does.
 */
export function TopBarLeading({ clubId }: { clubId: string }) {
  const pathname = usePathname();
  const clubPath = overviewHref(clubId);
  const history = useBackHref(pathname, clubPath, parentPage(pathname, clubPath));
  const songbook = useSongbookHref(clubId);

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
