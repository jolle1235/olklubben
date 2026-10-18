import type { FeedbackStatus } from "./status";

/**
 * Feedback permissions (SPEC §9.9 "Rettigheder", D-145). Feedback is app-wide
 * (§3.3 exception): there is no membership in these rules, only the logged-in
 * viewer, whether they are an app-admin (isAppAdmin, D-142) and who wrote the
 * report.
 *
 *   * Everyone logged in sees every report and may create one.
 *   * 👍: anyone but the author (their report already counts as 1). App-admins
 *     vote like everyone else, also not on their own report.
 *   * Edit title/description and delete: the author while the status is NEW,
 *     or an app-admin. The data layer repeats "author AND NEW" in the WHERE of
 *     the same statement, so a concurrent status change wins (D-145).
 *   * Status, response, duplicate and the technical info: app-admins only.
 *
 * A report whose author deleted their account has createdById null: nobody is
 * its author any more, so only app-admins may change it.
 *
 * The same functions hide buttons in the UI and enforce the rules on the
 * server. Pure module: no Next.js, React or database imports. Client-safe.
 */

export type FeedbackViewer = { userId: string; isAppAdmin: boolean };

export type FeedbackRightsRef = { createdById: string | null; status: FeedbackStatus };

function isAuthor(viewer: FeedbackViewer, feedback: Pick<FeedbackRightsRef, "createdById">) {
  return feedback.createdById !== null && feedback.createdById === viewer.userId;
}

export function canViewFeedback(viewer: FeedbackViewer): boolean {
  void viewer;
  return true;
}

export function canCreateFeedback(viewer: FeedbackViewer): boolean {
  void viewer;
  return true;
}

/** Anyone but the author (an app-admin too, but not on their own report). */
export function canVoteOnFeedback(
  viewer: FeedbackViewer,
  feedback: Pick<FeedbackRightsRef, "createdById">,
): boolean {
  return !isAuthor(viewer, feedback);
}

/** Title and description: the author while NEW, or an app-admin. */
export function canEditFeedback(viewer: FeedbackViewer, feedback: FeedbackRightsRef): boolean {
  return viewer.isAppAdmin || (isAuthor(viewer, feedback) && feedback.status === "NEW");
}

/** The author while NEW, or an app-admin. */
export function canDeleteFeedback(viewer: FeedbackViewer, feedback: FeedbackRightsRef): boolean {
  return viewer.isAppAdmin || (isAuthor(viewer, feedback) && feedback.status === "NEW");
}

/** Status, response and duplicate: app-admins only. */
export function canModerateFeedback(viewer: FeedbackViewer): boolean {
  return viewer.isAppAdmin;
}

/** User agent and screen width: app-admins only (§9.9). */
export function canSeeFeedbackTechInfo(viewer: FeedbackViewer): boolean {
  return viewer.isAppAdmin;
}
