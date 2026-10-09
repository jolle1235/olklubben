/**
 * The suggested title for a new event (SPEC §9.2, D-064): "Ølsmagning #N",
 * where N = the number of events in the club + 1. The member may overwrite it.
 *
 * Refinement: given the existing titles, N is also at least one more than the
 * highest "Ølsmagning #N" among them. A club that starts using the app at its
 * 14th tasting ("Ølsmagning #14") then gets "#15" next, not "#2".
 *
 * Pure module: no Next.js, React or database imports. Client-safe.
 */

export const EVENT_TITLE_PREFIX = "Ølsmagning";

const NUMBERED_TITLE = /^\s*ølsmagning\s*#\s*(\d{1,6})\s*$/iu;

/** 14 for "Ølsmagning #14" (any case and spacing), else null. */
export function eventTitleNumber(title: string): number | null {
  const match = NUMBERED_TITLE.exec(title);
  return match ? Number(match[1]) : null;
}

/**
 * "Ølsmagning #13" when the club has 12 events (or its highest numbered title
 * is #12). Bad counts are treated as 0.
 */
export function suggestEventTitle(
  existingCount: number,
  existingTitles: readonly string[] = [],
): string {
  const count = Number.isFinite(existingCount) ? Math.max(0, Math.floor(existingCount)) : 0;
  const highest = existingTitles.reduce(
    (max, title) => Math.max(max, eventTitleNumber(title) ?? 0),
    0,
  );
  return `${EVENT_TITLE_PREFIX} #${Math.max(count, highest) + 1}`;
}
