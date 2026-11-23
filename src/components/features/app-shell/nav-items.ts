import {
  BeerIcon,
  CalendarDaysIcon,
  HouseIcon,
  MusicIcon,
  SettingsIcon,
  type LucideIcon,
} from "lucide-react";

import { clubHref, placesHref, profileHref, settingsHref } from "@/lib/routes";

export type NavKey = "overview" | "calendar" | "beers" | "songs" | "settings";

/**
 * The main pages' names: their h1 and the mobile top bar's text (D-189).
 * Overblik's is the club's name.
 */
export const MAIN_PAGE_TITLES = {
  calendar: "Kalender",
  beers: "Ølkatalog",
  songs: "Sangbog",
  settings: "Indstillinger",
} as const satisfies Record<Exclude<NavKey, "overview">, string>;

/** Feedback (SPEC §9.9) is app-wide, so the same prefix for every club. */
const FEEDBACK_PATH = "/feedback";

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
      // Indstillinger (D-183): Konto, the club page, the places and the
      // app-wide Feedback (§9.9, D-147, outside the club's URL space) are its
      // subpages.
      key: "settings",
      label: "Indstillinger",
      href: settingsHref(clubId),
      icon: SettingsIcon,
      exact: false,
      alsoActiveOn: [profileHref(clubId), clubHref(clubId), placesHref(clubId), FEEDBACK_PATH],
      // On desktop the user row at the bottom of the sidebar is the way to Indstillinger.
      sidebar: "user-row",
    },
  ];
}

export type SidebarNav = {
  /** The items in the sidebar's list (Overblik, Kalender, Øl, Sangbog). */
  list: NavItem[];
  /** The item behind the user row at the bottom of the sidebar (Indstillinger). */
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

/**
 * The name of the main page at `pathname` (the bottom nav's destinations), for
 * the mobile top bar (D-189): the club's name on Overblik. Null on any other
 * page.
 */
export function mainPageTitle(pathname: string, clubId: string, clubName: string): string | null {
  const path = stripTrailingSlash(pathname);
  const item = getNavItems(clubId).find((candidate) => candidate.href === path);
  if (!item) return null;
  return item.key === "overview" ? clubName : MAIN_PAGE_TITLES[item.key];
}
