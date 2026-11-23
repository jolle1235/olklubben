"use client";

import { usePathname } from "next/navigation";

import { StatusBarBackdrop } from "@/components/features/status-bar-backdrop";
import { isSubpage } from "@/lib/nav-history";

import { TOP_BAR_ACTION_SLOT_ID } from "./top-bar-action";
import { TopBarLeading } from "./top-bar-leading";

export type TopBarProps = {
  clubId: string;
};

/**
 * Mobile top bar (< md), only on subpages (D-183): "‹ Tilbage" and a slot for
 * a page tool (TopBarAction), always mounted there so a portal finds it. The
 * page's name is only its own h1 (D-188). Main pages have no bar: only
 * the frame colour under the status bar and the same height in the flow. Both
 * are 0 px since the status bar is "default" (D-188); kept so a switch back to
 * "black-translucent" needs no layout work.
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
          id={TOP_BAR_ACTION_SLOT_ID}
          className="ml-auto flex shrink-0 items-center gap-2 empty:hidden"
        />
      </div>
    </header>
  );
}
