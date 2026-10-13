"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";

import { songsHref } from "@/lib/routes";

import { SONGBOOK_LIST_URL_KEY } from "./songbook-session";

const noopSubscribe = () => () => {};

/**
 * The list URL SongbookBrowser stored (with the search), if it is a songbook
 * URL of THIS club: songsHref, optionally with a query, and no "//".
 */
function storedListUrl(clubId: string): string | null {
  try {
    const url = window.sessionStorage.getItem(SONGBOOK_LIST_URL_KEY);
    const base = songsHref(clubId);
    if (url === null || url.includes("//")) return null;
    return url === base || url.startsWith(`${base}?`) ? url : null;
  } catch {
    return null;
  }
}

/**
 * "‹ Sangbog" above the song (SPEC §9.6). Back to the list, with the search
 * the member came from: there is no browser back button in the iOS home
 * screen app. Plain songsHref before hydration.
 */
export function BackToSongbook({ clubId }: { clubId: string }) {
  const href = useSyncExternalStore(
    noopSubscribe,
    () => storedListUrl(clubId) ?? songsHref(clubId),
    () => songsHref(clubId),
  );

  return (
    <Link
      href={href}
      className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 font-semibold text-olive underline-offset-4 hover:underline"
    >
      <ChevronLeftIcon aria-hidden className="size-5" />
      Sangbog
    </Link>
  );
}
