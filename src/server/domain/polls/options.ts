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
