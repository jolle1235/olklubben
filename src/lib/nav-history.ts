/**
 * The tab's in-app history, for "Tilbage" on the event page (D-179): where
 * the member came from (Overblik, Kalender, a place, a beer …). There is no
 * browser back button in the iOS home screen app. recordVisit and
 * backTarget are pure; the stack lives in sessionStorage, written by
 * NavHistoryTracker.
 */

const NAV_HISTORY_KEY = "olklubben:nav-history";

const MAX_ENTRIES = 20;

/** Pages that are never a target of "Tilbage": create, edit and import forms. */
const FORM_PATH = /\/(new|edit|import)$/;

const pathOf = (url: string) => url.split(/[?#]/, 1)[0] ?? url;

/**
 * The stack after visiting `url` (path + query). Pages are compared by path:
 * the current page again (e.g. its ?toast= removed, another month) replaces
 * it; the page before the current one is a step back (pop, keeping the new
 * query); anything else is pushed. The pop is what stops event → beer →
 * "← event" from bouncing.
 */
export function recordVisit(stack: readonly string[], url: string): string[] {
  const path = pathOf(url);
  const last = stack.at(-1);
  const previous = stack.at(-2);
  if (last !== undefined && pathOf(last) === path) return [...stack.slice(0, -1), url];
  if (previous !== undefined && pathOf(previous) === path) return [...stack.slice(0, -2), url];
  return [...stack, url].slice(-MAX_ENTRIES);
}

/**
 * Where "Tilbage" on `here` goes: the latest earlier page in this club
 * (`clubPath`, e.g. /c/<id>) that is not a form, else `fallback`.
 */
export function backTarget(
  stack: readonly string[],
  here: string,
  clubPath: string,
  fallback: string,
): string {
  const earlier = recordVisit(stack, here).slice(0, -1).reverse();
  for (const url of earlier) {
    const pathname = pathOf(url);
    const inClub = pathname === clubPath || pathname.startsWith(`${clubPath}/`);
    if (inClub && !FORM_PATH.test(pathname)) return url;
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
