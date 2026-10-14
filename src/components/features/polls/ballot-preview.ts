import { z } from "zod";

import { formatDanishList } from "@/lib/format/list";
import { ballotMessage, ballotSchema } from "@/lib/validation/poll";
import { checkBallotChoice, type BallotChoice } from "@/server/domain/polls/ballot";
import type { CategoryMode, PollOptionRef } from "@/server/domain/polls/options";

/**
 * The vote form's optimistic preview (SPEC §9.7.3, §13.4.6, D-136): while the
 * member ticks, the counts, bars, avatars and the "Fører" chip move as if the
 * ballot were saved – the member's own avatar with a dashed ring until it is.
 * Nothing is stored before [Gem min stemme]; the server decides again.
 *
 * Pure module: client-safe and unit-tested.
 */

/** A voter as the rows show them (display name already resolved). */
export type PreviewVoter = {
  id: string;
  name: string;
  image: string | null;
  /** Has left the club: the vote stays as history (§7.4). */
  former: boolean;
};

/** One option and who STORED a tick on it (the viewer included when saved). */
export type PreviewOptionInput = { id: string; voters: readonly PreviewVoter[] };

/** What the form currently says (controlled inputs). */
export type BallotDraft = {
  dateOptionIds: readonly string[];
  noDateWorks: boolean;
  placeOptionId: string | null;
};

/** The viewer in a row: not there, there as saved, or there but not saved yet. */
export type ViewerMark = "none" | "saved" | "pending";

export type PreviewOption = {
  id: string;
  /** Others + the viewer's current tick. */
  count: number;
  /** The other voters, in stored order. */
  others: PreviewVoter[];
  viewer: ViewerMark;
  /** The unique top option of a votable category with count > 0. */
  isLeader: boolean;
  /** Bar width 0–1: count / max(1, top count of the category). */
  share: number;
};

export const EMPTY_DRAFT: BallotDraft = {
  dateOptionIds: [],
  noDateWorks: false,
  placeOptionId: null,
};

/** The draft a saved ballot starts as (or an empty one). */
export function draftFromBallot(
  ballot: {
    dateOptionIds: readonly string[];
    noDateWorks: boolean;
    placeOptionId: string | null;
  } | null,
): BallotDraft {
  if (!ballot) return EMPTY_DRAFT;
  return {
    dateOptionIds: [...ballot.dateOptionIds],
    noDateWorks: ballot.noDateWorks,
    placeOptionId: ballot.placeOptionId,
  };
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  const left = new Set(a);
  const right = new Set(b);
  return left.size === right.size && [...left].every((id) => right.has(id));
}

/** The form differs from the saved ballot ("Ikke gemt endnu"; pauses the auto-refresh). */
export function isDraftDirty(draft: BallotDraft, saved: BallotDraft): boolean {
  return (
    draft.noDateWorks !== saved.noDateWorks ||
    draft.placeOptionId !== saved.placeOptionId ||
    !sameSet(draft.dateOptionIds, saved.dateOptionIds)
  );
}

/** Ticking a date unticks «Ingen af datoerne passer mig» (and the other way round). */
export function toggleDraftDate(
  draft: BallotDraft,
  optionId: string,
  checked: boolean,
): BallotDraft {
  const rest = draft.dateOptionIds.filter((id) => id !== optionId);
  return checked
    ? { ...draft, dateOptionIds: [...rest, optionId], noDateWorks: false }
    : { ...draft, dateOptionIds: rest };
}

export function setDraftNoDateWorks(draft: BallotDraft, checked: boolean): BallotDraft {
  return checked
    ? { ...draft, dateOptionIds: [], noDateWorks: true }
    : { ...draft, noDateWorks: false };
}

export function setDraftPlace(draft: BallotDraft, optionId: string): BallotDraft {
  return { ...draft, placeOptionId: optionId };
}

/**
 * The rows of one category as the preview shows them. `ticked` = the draft's
 * choice, `saved` = the stored ballot's. The leader is recomputed from the
 * previewed counts, so ticking can make an option lead.
 */
export function previewOptions(input: {
  options: readonly PreviewOptionInput[];
  viewerId: string;
  ticked: ReadonlySet<string>;
  saved: ReadonlySet<string>;
  mode: CategoryMode;
}): PreviewOption[] {
  const rows = input.options.map((option) => {
    const others = option.voters.filter((voter) => voter.id !== input.viewerId);
    const ticked = input.ticked.has(option.id);
    const viewer: ViewerMark = !ticked ? "none" : input.saved.has(option.id) ? "saved" : "pending";
    return { id: option.id, others, viewer, count: others.length + (ticked ? 1 : 0) };
  });
  const top = Math.max(0, ...rows.map((row) => row.count));
  const atTop = rows.filter((row) => row.count === top).length;
  return rows.map((row) => ({
    ...row,
    isLeader: input.mode === "vote" && top > 0 && atTop === 1 && row.count === top,
    share: row.count / Math.max(1, top),
  }));
}

/**
 * «Ingen af datoerne passer mig» as a row of its own (never a leader). Its bar
 * is measured against the dates' top count, so it reads on the same scale.
 */
export function previewNoDateWorks(input: {
  voters: readonly PreviewVoter[];
  viewerId: string;
  ticked: boolean;
  saved: boolean;
  dateTop: number;
}): PreviewOption {
  const others = input.voters.filter((voter) => voter.id !== input.viewerId);
  const count = others.length + (input.ticked ? 1 : 0);
  const viewer: ViewerMark = !input.ticked ? "none" : input.saved ? "saved" : "pending";
  return {
    id: "noDateWorks",
    count,
    others,
    viewer,
    isLeader: false,
    share: count / Math.max(1, input.dateTop, count),
  };
}

/** The top count among previewed rows (for the «Ingen passer» bar). */
export function topCount(rows: readonly PreviewOption[]): number {
  return Math.max(0, ...rows.map((row) => row.count));
}

// ── Texts ───────────────────────────────────────────────────────────────────

/** Which row a sentence is about: a date ("kan"), a place ("stemmer") or «Ingen passer». */
export type VoterRowKind = "date" | "place" | "none";

/** The row's voters by name, the viewer last as "dig" (like "Mangler: …"). */
export function voterNames(others: readonly PreviewVoter[], viewer: ViewerMark): string[] {
  const names = others.map((voter) => voter.name);
  return viewer === "none" ? names : [...names, "dig"];
}

/**
 * The row's description for screen readers (and the text under the bar):
 * "3 kan: Mads, Anders og dig" · "2 stemmer: Mads og Bo" · "1 kan ingen af
 * datoerne: Anders" · "Ingen endnu".
 */
export function votersSentence(
  kind: VoterRowKind,
  row: Pick<PreviewOption, "count" | "others" | "viewer">,
): string {
  const names = formatDanishList(voterNames(row.others, row.viewer));
  if (row.count === 0 || names === "") return "Ingen endnu";
  switch (kind) {
    case "date":
      return `${row.count} kan: ${names}`;
    case "place":
      return `${row.count} ${row.count === 1 ? "stemme" : "stemmer"}: ${names}`;
    case "none":
      return `${row.count} kan ingen af datoerne: ${names}`;
  }
}

/**
 * The vote form's browser validation: the shared ballotSchema plus this poll's
 * completeness (a date or «Ingen passer», and one place, where there is
 * something to vote on), with the server's own messages (ballotMessage). The
 * server checks again under the lock (castBallot → checkBallotChoice).
 * DATE_AND_NONE is already the schema's own refine (F-056: never twice), and
 * an unknown option can only come from a stale page – the server answers it.
 */
export function voteFormSchema(options: readonly PollOptionRef[]) {
  return ballotSchema.superRefine((choice: BallotChoice, ctx) => {
    const check = checkBallotChoice(options, choice);
    if (check.ok) return;
    for (const code of Object.values(check.errors)) {
      if (!code || code === "DATE_AND_NONE" || code === "UNKNOWN_OPTION") continue;
      const { field, message } = ballotMessage(code);
      if (field) ctx.addIssue({ code: "custom", path: [field], message });
    }
  }) satisfies z.ZodType;
}
