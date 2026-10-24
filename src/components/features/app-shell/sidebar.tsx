"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { LogoutButton } from "@/components/features/profile/logout-button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ClubSwitcher, type ClubSummary } from "./club-switcher";
import { getSidebarNav, isNavItemActive } from "./nav-items";

export type ShellUser = { name: string; email: string; image?: string | null };

export type SidebarProps = {
  club: ClubSummary;
  clubs: ClubSummary[];
  user: ShellUser;
  className?: string;
};

/**
 * Desktop navigation (md+): olive sidebar with logo, club switcher, the list
 * (Overblik, Kalender, Øl, Sangbog) and, at the bottom, the user row, which is
 * the way to Profil (and the club page) on desktop, with "Log ud" under it.
 */
export function Sidebar({ club, clubs, user, className }: SidebarProps) {
  const pathname = usePathname();
  const { list, userRow } = getSidebarNav(club.id);
  const overview = list[0]?.href ?? "/";
  const userRowActive = isNavItemActive(pathname, userRow);

  return (
    <div
      className={cn(
        "sticky top-0 hidden h-dvh flex-col overflow-y-auto on-olive md:flex",
        className,
      )}
    >
      <div className="px-5 pt-6">
        <Link href={overview} className="inline-flex rounded-lg">
          <Logo tone="cream" size="md" />
        </Link>
      </div>

      <div className="mt-7 px-3">
        <ClubSwitcher club={club} clubs={clubs} variant="sidebar" />
      </div>

      <nav aria-label="Hovednavigation" className="mt-6 flex flex-1 flex-col">
        <ul className="mb-6 flex flex-col gap-1 px-3">
          {list.map((item) => {
            const active = isNavItemActive(pathname, item);
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group/nav flex min-h-12 items-center gap-3.5 rounded-xl px-3 text-[1.05rem] font-semibold transition-colors",
                    active
                      ? "bg-olive-soft text-cream [--porthole-gap:var(--olive-soft)]"
                      : "text-on-dark-muted hover:bg-olive-soft/60 hover:text-cream",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-full transition-colors [&_svg]:size-[1.15rem]",
                      active ? "porthole bg-amber text-olive-deep" : "bg-olive-deep/60",
                    )}
                  >
                    <Icon strokeWidth={2.25} />
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Profil on desktop: the user row, active on the profile and club pages
            like the bottom nav's Profil item. The brass ring marks it active,
            like the list's icons. */}
        <div className="mt-auto border-t border-white/10 p-3">
          <Link
            href={userRow.href}
            aria-current={userRowActive ? "page" : undefined}
            className={cn(
              "flex min-h-14 items-center gap-3 rounded-xl px-2.5 py-2 transition-colors",
              userRowActive
                ? "bg-olive-soft [--porthole-gap:var(--olive-soft)]"
                : "[--porthole-ring:var(--olive-soft)] hover:bg-olive-soft/60",
            )}
          >
            <span className="sr-only">{userRow.label}: </span>
            <UserAvatar name={user.name} image={user.image} size="sm" decorative />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-cream">{user.name}</span>
              <span className="block truncate text-sm text-on-dark-muted">{user.email}</span>
            </span>
          </Link>
          <LogoutButton variant="sidebar" className="mt-1" />
        </div>
      </nav>
    </div>
  );
}
