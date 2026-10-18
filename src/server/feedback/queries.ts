import "server-only";

import { cache } from "react";

import { getFeedbackAuthorName } from "@/lib/format/display-name";
import { isValidId } from "@/lib/ids";
import { db } from "@/server/db";
import type { FeedbackListParams } from "@/server/domain/feedback/list-params";
import { canSeeFeedbackTechInfo, type FeedbackViewer } from "@/server/domain/feedback/permissions";
import type { SimilarFeedbackCandidate } from "@/server/domain/feedback/similar";
import {
  statusesForFilter,
  type FeedbackStatus,
  type FeedbackType,
} from "@/server/domain/feedback/status";
import { feedbackVoteCount } from "@/server/domain/feedback/votes";

/**
 * Read queries for feedback (SPEC §9.9, D-141–D-145).
 *
 * Feedback is app-wide (§3.3 exception): no clubId, every logged-in user sees
 * every report. The caller has checked the session (requireUser /
 * requireFeedback). Nothing here ever selects a club, a club id or an email.
 *
 * 👍 counts are COMPUTED (§3.4): feedbackVoteCount(rows) = 1 (the author) +
 * the FeedbackVote rows. The technical info (user agent, screen width) is
 * only SELECTED for an app-admin (canSeeFeedbackTechInfo), so it never
 * reaches anyone else's page payload (D-145).
 */

/** At most this many reports per list page (TG-057: paging/search when there are more). */
export const FEEDBACK_LIST_LIMIT = 200;
/** "Lignende rapporter" matches against the newest this many (TG-057). */
export const SIMILAR_CANDIDATES_LIMIT = 300;
/** The app-admin's "Dublet af …" select offers the newest this many. */
export const DUPLICATE_TARGETS_LIMIT = 200;

const authorSelect = { select: { name: true, nickname: true } } as const;

// ── The guard reference ─────────────────────────────────────────────────────

export type FeedbackRef = {
  id: string;
  type: FeedbackType;
  status: FeedbackStatus;
  /** Null after the author deleted their account (E27). */
  createdById: string | null;
  title: string;
};

/** The report's id, type, status, author and title, or null. Cached per request. */
export const getFeedbackRef = cache(async (feedbackId: string): Promise<FeedbackRef | null> => {
  if (!isValidId(feedbackId)) return null;
  return db.feedback.findUnique({
    where: { id: feedbackId },
    select: { id: true, type: true, status: true, createdById: true, title: true },
  });
});

// ── The list (/feedback) ────────────────────────────────────────────────────

export type FeedbackListItem = {
  id: string;
  type: FeedbackType;
  title: string;
  status: FeedbackStatus;
  createdAt: Date;
  /** Display name, or "Tidligere bruger" (E27). */
  authorName: string;
  /** 1 + votes (computed). */
  voteCount: number;
  viewerHasVoted: boolean;
  isOwn: boolean;
};

const TYPE_OF_FILTER = { bug: "BUG", feature: "FEATURE" } as const;

/**
 * The reports for the list's filters (type, open/closed/all, "Mine
 * rapporter") and sort ("Flest stemmer": votes, then newest; or "Nyeste").
 * At most FEEDBACK_LIST_LIMIT.
 */
export async function listFeedback(
  viewer: FeedbackViewer,
  params: FeedbackListParams,
): Promise<FeedbackListItem[]> {
  const rows = await db.feedback.findMany({
    where: {
      ...(params.type === "all" ? {} : { type: TYPE_OF_FILTER[params.type] }),
      status: { in: statusesForFilter(params.status) },
      ...(params.mine ? { createdById: viewer.userId } : {}),
    },
    orderBy:
      params.sort === "votes"
        ? [{ votes: { _count: "desc" } }, { createdAt: "desc" }, { id: "desc" }]
        : [{ createdAt: "desc" }, { id: "desc" }],
    take: FEEDBACK_LIST_LIMIT,
    select: {
      id: true,
      type: true,
      title: true,
      status: true,
      createdAt: true,
      createdById: true,
      createdBy: authorSelect,
      _count: { select: { votes: true } },
      votes: { where: { userId: viewer.userId }, select: { userId: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    status: row.status,
    createdAt: row.createdAt,
    authorName: getFeedbackAuthorName(row.createdBy),
    voteCount: feedbackVoteCount(row._count.votes),
    viewerHasVoted: row.votes.length > 0,
    isOwn: row.createdById !== null && row.createdById === viewer.userId,
  }));
}

/**
 * Whether the user has written any report (any type and status). Tells the
 * empty "Mine rapporter" list apart: "Du har ikke sendt nogen rapporter
 * endnu." vs. reports that only other filters show.
 */
export async function hasOwnFeedback(userId: string): Promise<boolean> {
  const row = await db.feedback.findFirst({ where: { createdById: userId }, select: { id: true } });
  return row !== null;
}

/**
 * The candidates for "Lignende rapporter" on /feedback/new (matched in the
 * browser by findSimilarFeedback): the newest SIMILAR_CANDIDATES_LIMIT reports.
 */
export async function listSimilarCandidates(): Promise<SimilarFeedbackCandidate[]> {
  const rows = await db.feedback.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: SIMILAR_CANDIDATES_LIMIT,
    select: { id: true, title: true, status: true, _count: { select: { votes: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    voteCount: feedbackVoteCount(row._count.votes),
  }));
}

// ── The detail page (/feedback/[feedbackId]) ────────────────────────────────

export type FeedbackTechnicalInfo = {
  userAgent: string | null;
  viewportWidth: number | null;
};

export type FeedbackDetail = {
  id: string;
  type: FeedbackType;
  title: string;
  /** Plain text, "\n" kept (render as text, never as HTML/markdown). */
  description: string;
  /** BUG only, without the club id (E26). */
  pagePath: string | null;
  status: FeedbackStatus;
  adminResponse: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** For the permission functions (canEditFeedback …). Null after E27. */
  createdById: string | null;
  authorName: string;
  isOwn: boolean;
  voteCount: number;
  viewerHasVoted: boolean;
  /** The original when status is DUPLICATE (null if it was deleted since). */
  duplicateOf: { id: string; title: string } | null;
  /** App-admins only; null (and never selected) for everyone else. */
  technicalInfo: FeedbackTechnicalInfo | null;
};

/** One report for its page, or null (unknown or malformed id). */
export async function getFeedbackDetail(
  feedbackId: string,
  viewer: FeedbackViewer,
): Promise<FeedbackDetail | null> {
  if (!isValidId(feedbackId)) return null;
  // `false` leaves the columns out of the SQL: a non-admin's query never reads them.
  const withTech = canSeeFeedbackTechInfo(viewer);
  const row = await db.feedback.findUnique({
    where: { id: feedbackId },
    select: {
      id: true,
      type: true,
      title: true,
      description: true,
      pagePath: true,
      status: true,
      adminResponse: true,
      createdAt: true,
      updatedAt: true,
      createdById: true,
      createdBy: authorSelect,
      duplicateOf: { select: { id: true, title: true } },
      _count: { select: { votes: true } },
      votes: { where: { userId: viewer.userId }, select: { userId: true } },
      userAgent: withTech,
      viewportWidth: withTech,
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    pagePath: row.pagePath,
    status: row.status,
    adminResponse: row.adminResponse,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdById: row.createdById,
    authorName: getFeedbackAuthorName(row.createdBy),
    isOwn: row.createdById !== null && row.createdById === viewer.userId,
    voteCount: feedbackVoteCount(row._count.votes),
    viewerHasVoted: row.votes.length > 0,
    duplicateOf: row.duplicateOf,
    technicalInfo: withTech
      ? { userAgent: row.userAgent ?? null, viewportWidth: row.viewportWidth ?? null }
      : null,
  };
}

export type DuplicateTarget = { id: string; type: FeedbackType; title: string };

/**
 * The reports an app-admin can name as the original of `excludeId`: every
 * other report that is not itself a duplicate (no chains, D-145), newest
 * first, at most DUPLICATE_TARGETS_LIMIT.
 */
export async function listDuplicateTargets(excludeId: string): Promise<DuplicateTarget[]> {
  return db.feedback.findMany({
    where: { id: { not: excludeId }, status: { not: "DUPLICATE" } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: DUPLICATE_TARGETS_LIMIT,
    select: { id: true, type: true, title: true },
  });
}
