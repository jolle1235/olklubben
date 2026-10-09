import { cn } from "@/lib/utils";
import { ClubSwitcher, type ClubSummary } from "./club-switcher";
import { TOP_BAR_ACTION_SLOT_ID } from "./top-bar-action";

export type TopBarProps = {
  club: ClubSummary;
  clubs: ClubSummary[];
  className?: string;
};

/** Mobile top bar (< md): the club name (ClubSwitcher) and a slot for the page's primary action. */
export function TopBar({ club, clubs, className }: TopBarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 on-olive pt-[env(safe-area-inset-top)] md:hidden",
        className,
      )}
    >
      <div className="flex h-16 items-center gap-2 pr-3 pl-2">
        <ClubSwitcher club={club} clubs={clubs} variant="topbar" className="min-w-0" />
        <div className="min-w-2 flex-1" />
        <div
          id={TOP_BAR_ACTION_SLOT_ID}
          className="flex shrink-0 items-center gap-2 empty:hidden"
        />
      </div>
    </header>
  );
}
