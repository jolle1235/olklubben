import { cn } from "@/lib/utils";
import type { ClubSummary } from "./club-switcher";
import { TOP_BAR_ACTION_SLOT_ID } from "./top-bar-action";
import { TopBarLeading } from "./top-bar-leading";
import { TOP_BAR_TITLE_SLOT_ID } from "@/components/ui/top-bar-title";

export type TopBarProps = {
  club: ClubSummary;
  clubs: ClubSummary[];
  className?: string;
};

/**
 * Mobile top bar (< md): the club switcher on a main page, "‹ Tilbage" and the
 * page's name (TopBarTitle) on a subpage (D-182), and a slot for a page tool
 * (TopBarAction). Both slots are always mounted, so a portal finds them.
 */
export function TopBar({ club, clubs, className }: TopBarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 surface-frame pt-[env(safe-area-inset-top)] md:hidden",
        className,
      )}
    >
      <div className="flex h-16 items-center gap-2 pr-3 pl-2">
        <TopBarLeading club={club} clubs={clubs} />
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
