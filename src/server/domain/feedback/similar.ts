import { stripNul } from "@/lib/text";

import { isOpenFeedbackStatus, type FeedbackStatus } from "./status";

/**
 * "Lignende rapporter" (SPEC §9.9): while someone types a title, the form
 * shows up to 3 existing reports that look like the same thing, so they can
 * 👍 one instead of writing a duplicate. A simple text match on the title:
 *
 *   * The title is normalised (NUL removed, NFC, Danish lowercase) and split
 *     into words of at least 3 letters or digits. A title shorter than 3
 *     characters, or without such a word, finds nothing.
 *   * A candidate's score is how many of those words occur inside one of its
 *     own title words ("kalender" matches "Kalenderen"). Score 0 is left out.
 *   * Ties: open reports first (Ny, Planlagt, I gang), then most 👍, then the
 *     newest id.
 *
 * One implementation, run in the browser on the candidates the page sends
 * (listSimilarCandidates). Pure module: client-safe.
 */

export type SimilarFeedbackCandidate = {
  id: string;
  title: string;
  status: FeedbackStatus;
  voteCount: number;
};

export const SIMILAR_FEEDBACK_LIMIT = 3;
const MIN_WORD_LENGTH = 3;
/** A forged or pasted title longer than this is only matched on its start. */
const MAX_TITLE_LENGTH = 200;

function words(text: string): string[] {
  return stripNul(text)
    .slice(0, MAX_TITLE_LENGTH)
    .normalize("NFC")
    .toLocaleLowerCase("da")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0);
}

export function findSimilarFeedback<T extends SimilarFeedbackCandidate>(
  title: string,
  candidates: readonly T[],
  limit: number = SIMILAR_FEEDBACK_LIMIT,
): T[] {
  if (title.trim().length < MIN_WORD_LENGTH) return [];
  const queryWords = [...new Set(words(title).filter((word) => word.length >= MIN_WORD_LENGTH))];
  if (queryWords.length === 0) return [];

  const scored: { candidate: T; score: number }[] = [];
  for (const candidate of candidates) {
    const titleWords = words(candidate.title);
    const score = queryWords.filter((query) =>
      titleWords.some((word) => word.includes(query)),
    ).length;
    if (score > 0) scored.push({ candidate, score });
  }

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      Number(isOpenFeedbackStatus(b.candidate.status)) -
        Number(isOpenFeedbackStatus(a.candidate.status)) ||
      b.candidate.voteCount - a.candidate.voteCount ||
      (a.candidate.id < b.candidate.id ? 1 : a.candidate.id > b.candidate.id ? -1 : 0),
  );
  return scored.slice(0, Math.max(0, limit)).map((entry) => entry.candidate);
}
