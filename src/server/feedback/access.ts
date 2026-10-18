import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";

import { appAdminEmails } from "@/env";
import { isValidId } from "@/lib/ids";
import { requireUser, type SessionUser } from "@/server/auth/session";
import { isAppAdmin } from "@/server/domain/feedback/app-admin";
import type { FeedbackViewer } from "@/server/domain/feedback/permissions";

import { getFeedbackRef, type FeedbackRef } from "./queries";

/**
 * Access to feedback for its pages and actions (SPEC §9.9, D-142, D-145).
 *
 * Feedback is app-wide: there is no membership, only a logged-in user. A
 * report is public to every user, so a missing right is FORBIDDEN, never a
 * 404; only an unknown or malformed id is a 404.
 *
 *   getFeedbackViewer(user)    who is looking: the user id and whether the
 *                              email is on APP_ADMIN_EMAILS (never a club role).
 *   requireFeedback(id)        logged in (else /login) + the report (else
 *                              notFound()). Never writes, so it is safe in a
 *                              guard layout. Cached per request.
 */

export function getFeedbackViewer(user: SessionUser): FeedbackViewer {
  return { userId: user.id, isAppAdmin: isAppAdmin(user.email, appAdminEmails) };
}

export type FeedbackAccess = {
  user: SessionUser;
  viewer: FeedbackViewer;
  feedback: FeedbackRef;
};

export const requireFeedback = cache(async (feedbackId: string): Promise<FeedbackAccess> => {
  const user = await requireUser();
  if (!isValidId(feedbackId)) notFound();
  const feedback = await getFeedbackRef(feedbackId);
  if (!feedback) notFound();
  return { user, viewer: getFeedbackViewer(user), feedback };
});
