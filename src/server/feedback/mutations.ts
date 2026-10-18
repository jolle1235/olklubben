import "server-only";

import type { FeedbackCreateData, FeedbackModerationData } from "@/lib/validation/feedback";
import { db } from "@/server/db";
import { lockFeedbackRows } from "@/server/db/locks";
import { canModerateFeedback, type FeedbackViewer } from "@/server/domain/feedback/permissions";
import { feedbackVoteCount } from "@/server/domain/feedback/votes";

/**
 * Writes for feedback (SPEC §9.9, D-141–D-145).
 *
 * The Server Actions check the rights first (src/server/domain/feedback/
 * permissions.ts); every write here repeats the rule IN the statement, so a
 * concurrent change can never slip past it:
 *
 *   * edit/delete: an app-admin by id; anyone else only WHERE id AND
 *     created_by_id = them AND status = 'NEW'. Zero rows → the row is read
 *     again to say why ("not-found", "locked": your report but no longer
 *     NEW, or "forbidden").
 *   * 👍: one INSERT … SELECT … WHERE created_by_id IS DISTINCT FROM the voter
 *     ON CONFLICT DO NOTHING, so voting on your own report is impossible even
 *     without the action's check, and a double tap is a no-op. The count is
 *     always read fresh (1 + rows, §3.4).
 *   * moderation (app-admins): one transaction holding lockFeedbackRows on the
 *     report and the original, so the original cannot vanish or become a
 *     duplicate itself meanwhile (no chains or cycles). Votes are never moved
 *     (E28).
 *
 * Inputs are already cleaned by the Zod schemas (src/lib/validation/feedback.ts).
 */

export type FeedbackWriteResult = "ok" | "not-found" | "locked" | "forbidden";

/** What createFeedback stores: the form's data + the request's user agent (BUG only). */
export type FeedbackCreateInput = FeedbackCreateData & { userAgent: string | null };

/** "Ny rapport": status NEW, by `actorId`. The technical fields are kept for bugs only. */
export async function createFeedback(
  actorId: string,
  data: FeedbackCreateInput,
): Promise<{ id: string }> {
  const isBug = data.type === "BUG";
  return db.feedback.create({
    data: {
      type: data.type,
      title: data.title,
      description: data.description,
      pagePath: isBug ? data.pagePath : null,
      userAgent: isBug ? data.userAgent : null,
      viewportWidth: isBug ? data.viewportWidth : null,
      createdById: actorId,
    },
    select: { id: true },
  });
}

/** The WHERE that encodes "app-admin, or the author while NEW". */
function writableWhere(viewer: FeedbackViewer, feedbackId: string) {
  return viewer.isAppAdmin
    ? { id: feedbackId }
    : { id: feedbackId, createdById: viewer.userId, status: "NEW" as const };
}

/** Why a guarded write touched no row. */
async function whyNotWritten(
  viewer: FeedbackViewer,
  feedbackId: string,
): Promise<Exclude<FeedbackWriteResult, "ok">> {
  const row = await db.feedback.findUnique({
    where: { id: feedbackId },
    select: { createdById: true },
  });
  if (!row) return "not-found";
  return row.createdById !== null && row.createdById === viewer.userId ? "locked" : "forbidden";
}

/** Title and description (author while NEW, or an app-admin). */
export async function updateFeedback(
  viewer: FeedbackViewer,
  feedbackId: string,
  data: { title: string; description: string },
): Promise<FeedbackWriteResult> {
  const { count } = await db.feedback.updateMany({
    where: writableWhere(viewer, feedbackId),
    data: { title: data.title, description: data.description },
  });
  return count === 1 ? "ok" : whyNotWritten(viewer, feedbackId);
}

/**
 * Deletes the report (author while NEW, or an app-admin). Its votes go with
 * it (CASCADE); duplicates pointing at it keep status DUPLICATE with
 * duplicate_of_id NULL (SET NULL).
 */
export async function deleteFeedback(
  viewer: FeedbackViewer,
  feedbackId: string,
): Promise<FeedbackWriteResult> {
  const { count } = await db.feedback.deleteMany({ where: writableWhere(viewer, feedbackId) });
  return count === 1 ? "ok" : whyNotWritten(viewer, feedbackId);
}

export type FeedbackVoteResult =
  { status: "ok"; voted: boolean; voteCount: number } | { status: "own" } | { status: "not-found" };

/**
 * Sets the viewer's 👍 to `voted` (idempotent both ways). Refused on your own
 * report ("own") by the INSERT itself. Returns the fresh count (1 + votes).
 */
export async function setFeedbackVote(
  viewer: FeedbackViewer,
  feedbackId: string,
  voted: boolean,
): Promise<FeedbackVoteResult> {
  if (voted) {
    const inserted = await db.$executeRaw`
      INSERT INTO feedback_votes (feedback_id, user_id, created_at)
      SELECT f.id, ${viewer.userId}::text, now()
      FROM feedback f
      WHERE f.id = ${feedbackId} AND f.created_by_id IS DISTINCT FROM ${viewer.userId}::text
      ON CONFLICT DO NOTHING`;
    if (inserted === 0) {
      const row = await db.feedback.findUnique({
        where: { id: feedbackId },
        select: { createdById: true },
      });
      if (!row) return { status: "not-found" };
      if (row.createdById !== null && row.createdById === viewer.userId) return { status: "own" };
      // Otherwise the vote was already there: fine.
    }
  } else {
    await db.feedbackVote.deleteMany({ where: { feedbackId, userId: viewer.userId } });
  }

  const fresh = await db.feedback.findUnique({
    where: { id: feedbackId },
    select: { _count: { select: { votes: true } } },
  });
  if (!fresh) return { status: "not-found" };
  return { status: "ok", voted, voteCount: feedbackVoteCount(fresh._count.votes) };
}

export type FeedbackModerationResult =
  "ok" | "forbidden" | "not-found" | "duplicate-target-missing" | "duplicate-target-is-duplicate";

/**
 * Status, answer and duplicate (app-admins, §9.9, E28). Refuses non-admins
 * itself as well (defence in depth). DUPLICATE needs an original that exists
 * and is not a duplicate; any other status clears duplicateOfId. Votes stay
 * where they are.
 */
export async function moderateFeedback(
  viewer: FeedbackViewer,
  input: FeedbackModerationData,
): Promise<FeedbackModerationResult> {
  if (!canModerateFeedback(viewer)) return "forbidden";
  const duplicateOfId = input.status === "DUPLICATE" ? input.duplicateOfId : null;

  return db.$transaction(async (tx) => {
    const locked = await lockFeedbackRows(
      tx,
      duplicateOfId ? [input.feedbackId, duplicateOfId] : [input.feedbackId],
    );
    if (!locked.some((row) => row.id === input.feedbackId)) return "not-found";

    if (input.status === "DUPLICATE") {
      const original = locked.find((row) => row.id === duplicateOfId);
      if (!duplicateOfId || duplicateOfId === input.feedbackId || !original) {
        return "duplicate-target-missing";
      }
      if (original.status === "DUPLICATE") return "duplicate-target-is-duplicate";
    }

    await tx.feedback.update({
      where: { id: input.feedbackId },
      data: { status: input.status, adminResponse: input.adminResponse, duplicateOfId },
    });
    return "ok";
  });
}
