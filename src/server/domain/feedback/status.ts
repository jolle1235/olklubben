/**
 * Feedback types and statuses (SPEC §9.9, D-144): the enums, their Danish
 * labels and the status groups the list filters on.
 *
 *   * Open = Ny, Planlagt, I gang: still on the backlog.
 *   * Closed = Færdig, Afvist and Dublet. §9.9 lists only Færdig and Afvist
 *     under "lukkede"; a duplicate is closed too, because its original carries
 *     the work (extension, D-144).
 *
 * Pure module: no Next.js, React or database imports. Client-safe.
 */

/** Same values as the Prisma enum FeedbackType. */
export type FeedbackType = "BUG" | "FEATURE";
/** Same values as the Prisma enum FeedbackStatus. */
export type FeedbackStatus = "NEW" | "PLANNED" | "IN_PROGRESS" | "DONE" | "WONT_DO" | "DUPLICATE";

export const FEEDBACK_TYPES: readonly FeedbackType[] = ["BUG", "FEATURE"];

/** In the order the app-admin's status select shows them. */
export const FEEDBACK_STATUSES: readonly FeedbackStatus[] = [
  "NEW",
  "PLANNED",
  "IN_PROGRESS",
  "DONE",
  "WONT_DO",
  "DUPLICATE",
];

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  BUG: "Fejl",
  FEATURE: "Idé / ønske",
};

export const FEEDBACK_TYPE_ICONS: Record<FeedbackType, string> = {
  BUG: "🐞",
  FEATURE: "💡",
};

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  NEW: "Ny",
  PLANNED: "Planlagt",
  IN_PROGRESS: "I gang",
  DONE: "Færdig ✓",
  WONT_DO: "Afvist",
  DUPLICATE: "Dublet",
};

/** Still on the backlog (the list's default filter and the agent script). */
export const OPEN_FEEDBACK_STATUSES = [
  "NEW",
  "PLANNED",
  "IN_PROGRESS",
] as const satisfies readonly FeedbackStatus[];

/** Finished one way or another (DUPLICATE included, D-144). */
export const CLOSED_FEEDBACK_STATUSES = [
  "DONE",
  "WONT_DO",
  "DUPLICATE",
] as const satisfies readonly FeedbackStatus[];

export type FeedbackStatusFilter = "open" | "closed" | "all";

export function isOpenFeedbackStatus(status: FeedbackStatus): boolean {
  return (OPEN_FEEDBACK_STATUSES as readonly FeedbackStatus[]).includes(status);
}

export function isFeedbackType(value: unknown): value is FeedbackType {
  return typeof value === "string" && (FEEDBACK_TYPES as readonly string[]).includes(value);
}

export function isFeedbackStatus(value: unknown): value is FeedbackStatus {
  return typeof value === "string" && (FEEDBACK_STATUSES as readonly string[]).includes(value);
}

/** The statuses a list filter shows ("Åbne", "Lukkede", "Alle"). */
export function statusesForFilter(filter: FeedbackStatusFilter): FeedbackStatus[] {
  switch (filter) {
    case "open":
      return [...OPEN_FEEDBACK_STATUSES];
    case "closed":
      return [...CLOSED_FEEDBACK_STATUSES];
    case "all":
      return [...FEEDBACK_STATUSES];
  }
}
