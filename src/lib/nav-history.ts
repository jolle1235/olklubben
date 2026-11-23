/**
 * The tab's in-app history, for "Tilbage" on the event page (D-179): where
 * the member came from (Overblik, Kalender, a place, a beer …). There is no
 * browser back button in the iOS home screen app. recordVisit and
 * backTarget are pure; the stack lives in sessionStorage, written by
 * NavHistoryTracker.
 */

import { UUID_SOURCE } from "./ids";

const NAV_HISTORY_KEY = "olklubben:nav-history";

const MAX_ENTRIES = 20;

/** Pages that are never a target of "Tilbage": create, edit and import forms. */
const FORM_PATH = /\/(new|edit|import)$/;

const pathOf = (url: string) => url.split(/[?#]/, 1)[0] ?? url;

/**
 * The app's main pages (the bottom navigation's destinations): Overblik,
 * Kalender, Ølkatalog, Sangbog and Indstillinger (D-183). Everything else (an
 * event, a place, a poll, a beer, a form, Klubben, Steder, Konto, Feedback) is
 * a side trip from where you were. `/profile` without a club only redirects.
 */
const MAIN_PAGE = /^(\/c\/[^/]+(\/(calendar|beers|songs|settings))?|\/profile)$/;
const FEEDBACK_PAGE = /^\/feedback(\/|$)/;
/** Feedback pages "Tilbage" may go to: the list and a report, not the form. */
const FEEDBACK_TARGET = new RegExp(`^/feedback(/${UUID_SOURCE})?$`, "i");
const isMainPage = (url: string) => MAIN_PAGE.test(pathOf(url));

const PARENTS: [RegExp, string][] = [
  [/^\/(club|places|profile)$/, "/settings"],
  [/^\/(events|polls)(\/|$)/, "/calendar"],
  [/^\/beers\//, "/beers"],
  [/^\/places\//, "/places"],
  [/^\/songs\//, "/songs"],
  [/^\/club\//, "/club"],
];

/** A song (not the songbook's forms): its "Tilbage" goes to the songbook with its search. */
export function isSongPage(pathname: string): boolean {
  return /^\/c\/[^/]+\/songs\/(?!new$|import$)[^/]+$/.test(pathname);
}

/** Where "Tilbage" goes without history: the list the subpage belongs to, else Overblik. */
export function parentPage(pathname: string, clubPath: string): string {
  if (FEEDBACK_PAGE.test(pathname)) {
    return pathname === "/feedback" ? `${clubPath}/settings` : "/feedback";
  }
  const rest = pathname.slice(clubPath.length);
  const parent = PARENTS.find(([pattern]) => pattern.test(rest))?.[1];
  return parent ? `${clubPath}${parent}` : clubPath;
}

/**
 * The stack after visiting `url` (path + query). Pages are compared by path:
 * the current page again (e.g. its ?toast= removed, another month) replaces
 * it. Back on an earlier page without a main page in between, the pages since
 * were side trips from it (event → its place, its poll, "Tilføj øl" → the
 * beer → "Smagt til"), so the stack rewinds to it and "Tilbage" never bounces
 * between the two. With a main page in between it is a new visit, pushed
 * (Kalender → event → Overblik → event goes back to Overblik). D-179, F-097.
 */
export function recordVisit(stack: readonly string[], url: string): string[] {
  const path = pathOf(url);
  const last = stack.at(-1);
  if (last !== undefined && pathOf(last) === path) return [...stack.slice(0, -1), url];
  const earlier = stack.findLastIndex((visited) => pathOf(visited) === path);
  if (earlier >= 0 && !stack.slice(earlier + 1).some(isMainPage)) {
    return [...stack.slice(0, earlier), url];
  }
  return [...stack, url].slice(-MAX_ENTRIES);
}

/**
 * Where "Tilbage" on `here` goes: the latest earlier page in this club
 * (`clubPath`, e.g. /c/<id>) that is not a form (from a feedback page also
 * the feedback list or a report, D-183), else `fallback`.
 */
export function backTarget(
  stack: readonly string[],
  here: string,
  clubPath: string,
  fallback: string,
): string {
  const earlier = recordVisit(stack, here).slice(0, -1).reverse();
  const inFeedback = FEEDBACK_PAGE.test(pathOf(here));
  for (const url of earlier) {
    const pathname = pathOf(url);
    const inClub = pathname === clubPath || pathname.startsWith(`${clubPath}/`);
    if ((inClub && !FORM_PATH.test(pathname)) || (inFeedback && FEEDBACK_TARGET.test(pathname)))
      return url;
  }
  return fallback;
}

/**
 * Set by the first write in this document. Until then the stored stack belongs
 * to an earlier page load (a reload, a pasted URL, the OS reopening the home
 * screen app) and is never trusted: "Tilbage" then goes to the calendar.
 * EventBackLink reads before the tracker's first effect, so this matters.
 */
let ownedByThisDocument = false;

/**
 * The stored stack; [] before this document's first write, or when it is
 * missing, unreadable or not a string list.
 */
export function readNavHistory(): string[] {
  if (!ownedByThisDocument) return [];
  try {
    const parsed: unknown = JSON.parse(window.sessionStorage.getItem(NAV_HISTORY_KEY) ?? "[]");
    return Array.isArray(parsed) && parsed.every((url) => typeof url === "string") ? parsed : [];
  } catch {
    return [];
  }
}

export function writeNavHistory(stack: readonly string[]): void {
  ownedByThisDocument = true;
  try {
    window.sessionStorage.setItem(NAV_HISTORY_KEY, JSON.stringify(stack));
  } catch {
    // Private mode or storage full: "Tilbage" falls back to the calendar.
  }
}
