import type { BallotVotes } from "./ballot";
import {
  optionsIn,
  pollShape,
  type CategoryMode,
  type PollCategory,
  type PollOptionRef,
} from "./options";

/**
 * Counting a poll (SPEC §9.7.6, D-008, D-013, E9). Results are COMPUTED from
 * the ballots on every read (§3.4); only the manual choice after a tie is
 * stored (PollTieResolution).
 *
 *   * DATE: approval voting, +1 per ticked date. A noDateWorks ballot adds its
 *     voter to noDateWorksVoterIds; its DATE ticks are ignored (defensive).
 *   * PLACE: one vote per ballot; only the first PLACE tick counts.
 *   * Unknown ids and ids of the wrong category are ignored.
 *   * A fixed category (one option) is "fixed". Otherwise the top count wins
 *     only if exactly ONE option has it; else it is a tie among every option
 *     at the top count – 0 ballots and "everyone chose Ingen passer" included.
 *   * Options keep the input order (the caller passes dates by startsAt and
 *     places by name); voterIds keep the ballot order (the caller sorts the
 *     ballots by display name).
 *
 * Pure module: no Next.js, React or database imports. Client-safe.
 */

export type OptionTally = { optionId: string; count: number; voterIds: string[] };

export type CategoryOutcome =
  | { kind: "fixed"; optionId: string }
  | { kind: "winner"; optionId: string; count: number }
  | { kind: "tie"; optionIds: string[]; count: number };

export type CategoryTally = {
  category: PollCategory;
  mode: CategoryMode;
  options: OptionTally[];
  outcome: CategoryOutcome;
};

export type PollTally = {
  date: CategoryTally;
  place: CategoryTally;
  noDateWorksVoterIds: string[];
  ballotCount: number;
};

function outcomeOf(mode: CategoryMode, options: readonly OptionTally[]): CategoryOutcome {
  if (mode === "fixed") {
    // A stored poll has ≥ 1 option per category; "" only for a malformed input.
    return { kind: "fixed", optionId: options[0]?.optionId ?? "" };
  }
  const top = Math.max(...options.map((option) => option.count));
  const leaders = options.filter((option) => option.count === top);
  const [first] = leaders;
  if (leaders.length === 1 && first)
    return { kind: "winner", optionId: first.optionId, count: top };
  return { kind: "tie", optionIds: leaders.map((option) => option.optionId), count: top };
}

export function tallyPoll(
  options: readonly PollOptionRef[],
  ballots: readonly BallotVotes[],
): PollTally {
  const shape = pollShape(options);
  const dateOptions = optionsIn(options, "DATE");
  const placeOptions = optionsIn(options, "PLACE");
  const counts = new Map<string, OptionTally>(
    [...dateOptions, ...placeOptions].map((option) => [
      option.id,
      { optionId: option.id, count: 0, voterIds: [] },
    ]),
  );
  const categoryOf = new Map(options.map((option) => [option.id, option.category]));
  const noDateWorksVoterIds: string[] = [];

  for (const ballot of ballots) {
    if (ballot.noDateWorks) noDateWorksVoterIds.push(ballot.userId);
    const seen = new Set<string>();
    let placeCounted = false;
    for (const optionId of ballot.optionIds) {
      if (seen.has(optionId)) continue;
      seen.add(optionId);
      const category = categoryOf.get(optionId);
      const tally = counts.get(optionId);
      if (!category || !tally) continue;
      if (category === "DATE" && ballot.noDateWorks) continue;
      if (category === "PLACE") {
        if (placeCounted) continue;
        placeCounted = true;
      }
      tally.count += 1;
      tally.voterIds.push(ballot.userId);
    }
  }

  const categoryTally = (category: PollCategory, refs: PollOptionRef[]): CategoryTally => {
    const tallies = refs.map((ref) => counts.get(ref.id)!);
    const mode = shape[category];
    return { category, mode, options: tallies, outcome: outcomeOf(mode, tallies) };
  };

  return {
    date: categoryTally("DATE", dateOptions),
    place: categoryTally("PLACE", placeOptions),
    noDateWorksVoterIds,
    ballotCount: ballots.length,
  };
}

/** The manual choice per tied category (option id). */
export type Resolutions = Partial<Record<PollCategory, string>>;

export type WinnerResult =
  | { ok: true; dateOptionId: string; placeOptionId: string }
  | { ok: false; reason: "TIE"; tied: PollCategory[] }
  | { ok: false; reason: "INVALID_CHOICE"; categories: PollCategory[] };

function categoryTallyOf(tally: PollTally, category: PollCategory): CategoryTally {
  return category === "DATE" ? tally.date : tally.place;
}

/** The categories that are tied, DATE first. */
export function tiedCategories(tally: PollTally): PollCategory[] {
  return (["DATE", "PLACE"] as const).filter(
    (category) => categoryTallyOf(tally, category).outcome.kind === "tie",
  );
}

/**
 * The winning option per category. Strict: a resolution for a category that
 * is not tied, or for an option outside the tied set, gives INVALID_CHOICE
 * (checked before TIE). A tied category without a resolution gives TIE.
 */
export function resolveWinner(tally: PollTally, resolutions: Resolutions = {}): WinnerResult {
  const invalid: PollCategory[] = [];
  const missing: PollCategory[] = [];
  const winners: Partial<Record<PollCategory, string>> = {};

  for (const category of ["DATE", "PLACE"] as const) {
    const { outcome } = categoryTallyOf(tally, category);
    const chosen = resolutions[category];
    if (outcome.kind === "tie") {
      if (chosen === undefined) missing.push(category);
      else if (!outcome.optionIds.includes(chosen)) invalid.push(category);
      else winners[category] = chosen;
    } else {
      if (chosen !== undefined) invalid.push(category);
      winners[category] = outcome.optionId;
    }
  }

  if (invalid.length > 0) return { ok: false, reason: "INVALID_CHOICE", categories: invalid };
  if (missing.length > 0) return { ok: false, reason: "TIE", tied: missing };
  return { ok: true, dateOptionId: winners.DATE!, placeOptionId: winners.PLACE! };
}

/**
 * For display: the decided option per category (fixed, winner, or a stored
 * resolution that is in the tied set), or null while tied. Never throws.
 */
export function displayWinners(
  tally: PollTally,
  resolutions: Resolutions,
): Record<PollCategory, string | null> {
  const winnerOf = (category: PollCategory): string | null => {
    const { outcome } = categoryTallyOf(tally, category);
    if (outcome.kind !== "tie") return outcome.optionId || null;
    const chosen = resolutions[category];
    return chosen !== undefined && outcome.optionIds.includes(chosen) ? chosen : null;
  };
  return { DATE: winnerOf("DATE"), PLACE: winnerOf("PLACE") };
}
