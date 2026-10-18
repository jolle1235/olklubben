import { DEFAULT_EVENT_START_TIME, type TimeOfDay } from "@/server/domain/events/time";

/**
 * Poll basics (SPEC §9.7, D-005, D-134): the enums, the limits and the shape
 * of a poll.
 *
 *   * A poll has date options and place options (≥ 1 of each, ≤ 10 of each).
 *   * A category with ONE option is "fixed": nothing to vote on there, it is
 *     simply part of the plan (§9.7.1). A category with more is "vote".
 *   * At least one category must be "vote", otherwise the poll is an event
 *     (D-134): hasSomethingToVoteOn.
 *
 * Pure module: no Next.js, React or database imports. Client-safe.
 */

/** Same values as the Prisma enum PollCategory. */
export type PollCategory = "DATE" | "PLACE";
/** Same values as the Prisma enum PollStatus. */
export type PollStatus = "OPEN" | "AWAITING_DECISION" | "CLOSED" | "CANCELLED";
/** Same values as the Prisma enum PollCloseReason. */
export type PollCloseReason = "DEADLINE" | "ALL_VOTED" | "MANUAL";

export const POLL_CATEGORIES: readonly PollCategory[] = ["DATE", "PLACE"];

/** E5, Overblik and the calendar: polls that are not finished. */
export const ACTIVE_POLL_STATUSES = [
  "OPEN",
  "AWAITING_DECISION",
] as const satisfies readonly PollStatus[];

export function isActivePollStatus(status: PollStatus): boolean {
  return (ACTIVE_POLL_STATUSES as readonly PollStatus[]).includes(status);
}

export const MAX_POLL_DATE_OPTIONS = 10;
export const MAX_POLL_PLACE_OPTIONS = 10;
/** One shared start time for every date option (D-134). */
export const DEFAULT_POLL_START_TIME: TimeOfDay = DEFAULT_EVENT_START_TIME;
/** The deadline field's default time. */
export const DEFAULT_POLL_DEADLINE_TIME: TimeOfDay = "20:00";

/** The part of an option the rules need. */
export type PollOptionRef = { id: string; category: PollCategory };

/** "vote" = more than one option; "fixed" = exactly one (§9.7.1). */
export type CategoryMode = "vote" | "fixed";
export type PollShape = Record<PollCategory, CategoryMode>;

/** The options of one category, in input order. */
export function optionsIn(
  options: readonly PollOptionRef[],
  category: PollCategory,
): PollOptionRef[] {
  return options.filter((option) => option.category === category);
}

/**
 * The mode per category. A category with 0 options (never stored: the data
 * layer requires ≥ 1) counts as "fixed", so nothing is ever voted on there.
 */
export function pollShape(options: readonly PollOptionRef[]): PollShape {
  const mode = (category: PollCategory): CategoryMode =>
    optionsIn(options, category).length > 1 ? "vote" : "fixed";
  return { DATE: mode("DATE"), PLACE: mode("PLACE") };
}

/** ≥ 1 of each AND (dates ≥ 2 || places ≥ 2) (D-134). */
export function hasSomethingToVoteOn(dateCount: number, placeCount: number): boolean {
  return dateCount >= 1 && placeCount >= 1 && (dateCount >= 2 || placeCount >= 2);
}

/** An option as stored: a date (startsAt) or a place (placeId). */
export type StoredPollOption = {
  id: string;
  category: PollCategory;
  startsAt: Date | null;
  placeId: string | null;
};

export type PollOptionsDiff = {
  /** Options that are no longer wanted. */
  removedIds: string[];
  /** Wanted dates without an option yet, in the given order. */
  addedDates: Date[];
  /** Wanted places without an option yet, in the given order. */
  addedPlaceIds: string[];
};

/**
 * What changes when a poll's options become exactly `dates` and `placeIds`
 * (D-153, "Rediger" while nobody has voted): an option for the same instant or
 * the same place is kept with its id, every other option is removed, and what
 * is still missing is added. Repeated wishes count once.
 */
export function diffPollOptions(
  current: readonly StoredPollOption[],
  wanted: { dates: readonly Date[]; placeIds: readonly string[] },
): PollOptionsDiff {
  const wantedDates = new Set(wanted.dates.map((date) => date.getTime()));
  const wantedPlaces = new Set(wanted.placeIds);
  const keptDates = new Set<number>();
  const keptPlaces = new Set<string>();
  const removedIds: string[] = [];

  for (const option of current) {
    const time = option.category === "DATE" ? (option.startsAt?.getTime() ?? null) : null;
    const placeId = option.category === "PLACE" ? option.placeId : null;
    if (time !== null && wantedDates.has(time) && !keptDates.has(time)) {
      keptDates.add(time);
    } else if (placeId !== null && wantedPlaces.has(placeId) && !keptPlaces.has(placeId)) {
      keptPlaces.add(placeId);
    } else {
      removedIds.push(option.id);
    }
  }

  const addedDates: Date[] = [];
  for (const date of wanted.dates) {
    const time = date.getTime();
    if (keptDates.has(time)) continue;
    keptDates.add(time);
    addedDates.push(new Date(time));
  }
  const addedPlaceIds: string[] = [];
  for (const placeId of wanted.placeIds) {
    if (keptPlaces.has(placeId)) continue;
    keptPlaces.add(placeId);
    addedPlaceIds.push(placeId);
  }
  return { removedIds, addedDates, addedPlaceIds };
}
