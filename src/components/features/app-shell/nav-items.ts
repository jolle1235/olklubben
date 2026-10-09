import {
  BeerIcon,
  CalendarDaysIcon,
  CircleUserRoundIcon,
  HouseIcon,
  MusicIcon,
  type LucideIcon,
} from "lucide-react";

export type NavKey = "overview" | "calendar" | "beers" | "songs" | "profile";

export type NavItem = {
  key: NavKey;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Active only on the exact href (Overblik), not on sub-pages. */
  exact: boolean;
  /** Other path prefixes that also mark the item active. */
  alsoActiveOn: string[];
  /**
   * Where the desktop sidebar shows the item: in its list, or as the user row
   * (avatar, name, email) at the bottom of the sidebar. The mobile bottom nav
   * has no user row, so it shows every item.
   */
  sidebar: "list" | "user-row";
};

/** Main navigation (SPEC §8.1, D-023). Labels are UI text, so Danish. */
export function getNavItems(clubId: string): NavItem[] {
  const base = `/c/${encodeURIComponent(clubId)}`;
  return [
    {
      key: "overview",
      label: "Overblik",
      href: base,
      icon: HouseIcon,
      exact: true,
      alsoActiveOn: [],
      sidebar: "list",
    },
    {
      key: "calendar",
      label: "Kalender",
      href: `${base}/calendar`,
      icon: CalendarDaysIcon,
      exact: false,
      // An event page belongs to the calendar (SPEC §9.3).
      alsoActiveOn: [`${base}/events`],
      sidebar: "list",
    },
    {
      key: "beers",
      label: "Øl",
      href: `${base}/beers`,
      icon: BeerIcon,
      exact: false,
      alsoActiveOn: [],
      sidebar: "list",
    },
    {
      key: "songs",
      label: "Sangbog",
      href: `${base}/songs`,
      icon: MusicIcon,
      exact: false,
      alsoActiveOn: [],
      sidebar: "list",
    },
    {
      // The club page lives under Profil (SPEC §8.1: "Profil → Klubben").
      key: "profile",
      label: "Profil",
      href: `${base}/profile`,
      icon: CircleUserRoundIcon,
      exact: false,
      alsoActiveOn: [`${base}/club`],
      // On desktop the user row at the bottom of the sidebar is the way to Profil.
      sidebar: "user-row",
    },
  ];
}

export type SidebarNav = {
  /** The items in the sidebar's list (Overblik, Kalender, Øl, Sangbog). */
  list: NavItem[];
  /** The item behind the user row at the bottom of the sidebar (Profil). */
  userRow: NavItem;
};

/** The desktop sidebar's split of getNavItems (same items, same active logic). */
export function getSidebarNav(clubId: string): SidebarNav {
  const items = getNavItems(clubId);
  const userRow = items.find((item) => item.sidebar === "user-row");
  if (!userRow) throw new Error("nav-items: the sidebar needs a user-row item");
  return { list: items.filter((item) => item.sidebar === "list"), userRow };
}

function stripTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Overblik is active only on /c/{id}; the others also on their sub-pages. */
export function isNavItemActive(
  pathname: string,
  item: Pick<NavItem, "href" | "exact" | "alsoActiveOn">,
): boolean {
  const path = stripTrailingSlash(pathname);
  if (item.exact ? path === item.href : matchesPrefix(path, item.href)) return true;
  return item.alsoActiveOn.some((prefix) => matchesPrefix(path, prefix));
}
