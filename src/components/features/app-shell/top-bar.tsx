"use client";

import { usePathname } from "next/navigation";

import { TOP_BAR_ACTION_SLOT_ID } from "./top-bar-action";
import { TopBarLeading } from "./top-bar-leading";
import { mainPageTitle } from "./nav-items";

export type TopBarProps = {
  clubId: string;
  clubName: string;
};

const BAR = "sticky top-0 z-30 surface-frame pt-[env(safe-area-inset-top)] md:hidden";

/**
 * Mobile top bar (< md) on every club page. A solid bar at the top keeps
 * iOS 26's scroll-edge blur off the page in the installed app (D-189).
 *
 * Main pages (D-189): the page's name. It is aria-hidden text, not a heading:
 * the page's own h1 (visually hidden below md, PageHeader `titleInTopBar`)
 * says the same, so there is one h1. A div, not a header, so no landmark
 * holds only hidden text.
 *
 * Subpages (D-182, D-188): "‹ Tilbage" and a slot for a page tool
 * (TopBarAction), always mounted there so a portal finds it. The page's name
 * is only its own h1.
 */
export function TopBar({ clubId, clubName }: TopBarProps) {
  const pathname = usePathname();
  const title = mainPageTitle(pathname, clubId, clubName);

  if (title !== null) {
    return (
      <div className={BAR}>
        <div className="flex h-16 items-center px-4">
          <p
            aria-hidden
            className="min-w-0 truncate text-body-md font-semibold text-frame-foreground"
          >
            {title}
          </p>
        </div>
      </div>
    );
  }

  return (
    <header className={BAR}>
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
