"use client";

import { usePathname } from "next/navigation";

import { StatusBarBackdrop } from "@/components/features/status-bar-backdrop";
import { TOP_BAR_TITLE_SLOT_ID } from "@/components/ui/top-bar-title";
import { isSubpage } from "@/lib/nav-history";

import { TOP_BAR_ACTION_SLOT_ID } from "./top-bar-action";
import { TopBarLeading } from "./top-bar-leading";

export type TopBarProps = {
  clubId: string;
};

/**
 * Mobile top bar (< md), only on subpages (D-183): "‹ Tilbage", the page's
 * name (TopBarTitle) and a slot for a page tool (TopBarAction); both slots are
 * always mounted there, so a portal finds them. Main pages have no bar: only
 * the frame colour under an installed app's status bar and the same height in
 * the flow (0 px in a browser).
 */
export function TopBar({ clubId }: TopBarProps) {
  const pathname = usePathname();

  if (!isSubpage(pathname)) {
    return (
      <div className="md:hidden">
        <StatusBarBackdrop />
        <div aria-hidden className="h-[env(safe-area-inset-top)]" />
      </div>
    );
  }

  return (
    <header className="sticky top-0 z-30 surface-frame pt-[env(safe-area-inset-top)] md:hidden">
      <div className="flex h-16 items-center gap-2 pr-3 pl-2">
        <TopBarLeading clubId={clubId} />
        <div
          id={TOP_BAR_TITLE_SLOT_ID}
          aria-hidden
          className="min-w-0 flex-1 truncate text-body-md font-semibold text-frame-foreground"
        />
        <div
          id={TOP_BAR_ACTION_SLOT_ID}
          className="flex shrink-0 items-center gap-2 empty:hidden"
        />
      </div>
    </header>
  );
}
