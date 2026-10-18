import { toDateKey } from "@/lib/format/date";

import { FEEDBACK_STATUS_LABELS, FEEDBACK_TYPE_ICONS, FEEDBACK_TYPE_LABELS } from "./status";
import type { FeedbackStatus, FeedbackType } from "./status";

/**
 * Plain-text output of scripts/list-feedback.ts (SPEC §9.9 "AI-agent og
 * feedback", D-146): one block per open report, most 👍 first, so an agent
 * (or Jesper) can read the backlog without the UI.
 *
 *   [<id>] 🐞 Fejl · Ny · 👍 4 · Kaptajnen · 2026-10-16
 *   Kalenderen viser forkert dato på mobil
 *   Side: /calendar
 *     Hvad skete der? …
 *   Svar: Rettet i version fra 12/10
 *   Teknisk info: Mozilla/5.0 … · 390 px      (only with --with-tech)
 *
 * The author is a display name ("Tidligere bruger" for a deleted account),
 * never an email. Dates are Copenhagen calendar days. Text written by users
 * is printed with its control characters replaced (except line breaks and
 * tabs), so a report can never send escape sequences to the terminal.
 *
 * Pure module: no Next.js, React or database imports.
 */

export type FeedbackCliItem = {
  id: string;
  type: FeedbackType;
  status: FeedbackStatus;
  title: string;
  description: string;
  pagePath: string | null;
  adminResponse: string | null;
  authorName: string;
  /** 1 (the author) + votes, computed (feedbackVoteCount). */
  upvotes: number;
  createdAt: Date;
  /** Only filled in with --with-tech. */
  userAgent?: string | null;
  viewportWidth?: number | null;
};

const REPLACEMENT = "�";

/** Replaces C0 controls (except "\n" and "\t"), DEL and C1 controls, e.g. ESC. */
export function terminalSafe(value: string): string {
  let result = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    const isControl =
      (code < 0x20 && char !== "\n" && char !== "\t") || (code >= 0x7f && code <= 0x9f);
    result += isControl ? REPLACEMENT : char;
  }
  return result;
}

function oneLine(value: string): string {
  return terminalSafe(value).replace(/\s+/g, " ").trim();
}

function indented(value: string): string {
  return terminalSafe(value)
    .split("\n")
    .map((line) => `  ${line}`.trimEnd())
    .join("\n");
}

function techInfoLine(item: FeedbackCliItem): string {
  const parts: string[] = [];
  if (item.userAgent) parts.push(oneLine(item.userAgent));
  if (item.viewportWidth != null) parts.push(`${item.viewportWidth} px`);
  return `Teknisk info: ${parts.length > 0 ? parts.join(" · ") : "–"}`;
}

/** One report as a block of lines (no trailing newline). */
export function formatFeedbackBlock(item: FeedbackCliItem, options: { withTech?: boolean } = {}) {
  const header = [
    `[${item.id}] ${FEEDBACK_TYPE_ICONS[item.type]} ${FEEDBACK_TYPE_LABELS[item.type]}`,
    FEEDBACK_STATUS_LABELS[item.status],
    `👍 ${item.upvotes}`,
    oneLine(item.authorName),
    toDateKey(item.createdAt),
  ].join(" · ");
  const lines = [header, oneLine(item.title)];
  if (item.pagePath) lines.push(`Side: ${oneLine(item.pagePath)}`);
  lines.push(indented(item.description));
  if (item.adminResponse) lines.push(`Svar: ${indented(item.adminResponse).trimStart()}`);
  if (options.withTech) lines.push(techInfoLine(item));
  return lines.join("\n");
}

/** "Ingen åbne rapporter.", "1 åben rapport", "7 åbne rapporter". */
export function feedbackSummary(count: number): string {
  if (count === 0) return "Ingen åbne rapporter.";
  return count === 1 ? "1 åben rapport" : `${count} åbne rapporter`;
}

/** Every block, separated by a blank line, then the summary. */
export function formatFeedbackList(
  items: readonly FeedbackCliItem[],
  options: { withTech?: boolean } = {},
): string {
  if (items.length === 0) return feedbackSummary(0);
  const blocks = items.map((item) => formatFeedbackBlock(item, options));
  return `${blocks.join("\n\n")}\n\n${feedbackSummary(items.length)}`;
}
