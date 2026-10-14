import { optionsIn, pollShape, type PollCategory, type PollOptionRef } from "./options";

/**
 * A member's ballot (SPEC §9.7.3, D-013, D-134).
 *
 *   * DATE (approval voting): tick every date that works, or "Ingen af
 *     datoerne passer mig" (noDateWorks) – never both.
 *   * PLACE: exactly one place.
 *   * A fixed category (one option) has no inputs: anything sent for it is
 *     dropped, and noDateWorks is forced to false when DATE is fixed (C8).
 *   * Only COMPLETE ballots are stored, so "har stemt" = a ballot exists.
 *
 * checkBallotChoice decides what castBallot stores; isBallotComplete applies
 * the same rules to stored votes (shouldAutoClose, "alle har stemt").
 *
 * Pure module: no Next.js, React or database imports. Client-safe.
 */

/** A stored ballot: who, "Ingen passer" and the ticked option ids. */
export type BallotVotes = {
  userId: string;
  noDateWorks: boolean;
  optionIds: readonly string[];
};

/** What the vote form sends (ballotSchema). */
export type BallotChoice = {
  dateOptionIds: readonly string[];
  noDateWorks: boolean;
  placeOptionId: string | null;
};

export type BallotErrorCode = "DATE_REQUIRED" | "DATE_AND_NONE" | "PLACE_REQUIRED" | "UNKNOWN_OPTION";

export type BallotField = "dateOptionIds" | "placeOptionId";

export type BallotCheck =
  | { ok: true; noDateWorks: boolean; votes: { optionId: string; category: PollCategory }[] }
  | { ok: false; errors: Partial<Record<BallotField, BallotErrorCode>> };

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

/**
 * The votes to store for a choice, or the errors per field. Duplicates are
 * removed. In a "vote" category an id that is not an option of this poll in
 * this category gives UNKNOWN_OPTION.
 */
export function checkBallotChoice(
  options: readonly PollOptionRef[],
  choice: BallotChoice,
): BallotCheck {
  const shape = pollShape(options);
  const errors: Partial<Record<BallotField, BallotErrorCode>> = {};
  const votes: { optionId: string; category: PollCategory }[] = [];
  let noDateWorks = false;

  if (shape.DATE === "vote") {
    const known = new Set(optionsIn(options, "DATE").map((option) => option.id));
    const dateIds = unique(choice.dateOptionIds);
    if (dateIds.some((id) => !known.has(id))) errors.dateOptionIds = "UNKNOWN_OPTION";
    else if (choice.noDateWorks && dateIds.length > 0) errors.dateOptionIds = "DATE_AND_NONE";
    else if (!choice.noDateWorks && dateIds.length === 0) errors.dateOptionIds = "DATE_REQUIRED";
    else {
      noDateWorks = choice.noDateWorks;
      for (const optionId of dateIds) votes.push({ optionId, category: "DATE" });
    }
  }

  if (shape.PLACE === "vote") {
    const known = new Set(optionsIn(options, "PLACE").map((option) => option.id));
    const placeId = choice.placeOptionId;
    if (placeId === null || placeId === "") errors.placeOptionId = "PLACE_REQUIRED";
    else if (!known.has(placeId)) errors.placeOptionId = "UNKNOWN_OPTION";
    else votes.push({ optionId: placeId, category: "PLACE" });
  }

  if (errors.dateOptionIds || errors.placeOptionId) return { ok: false, errors };
  return { ok: true, noDateWorks, votes };
}

/**
 * Whether a stored ballot is complete under the same rules. A null ballot is
 * false. Unknown ids are ignored (they cannot exist: the FKs refuse them).
 */
export function isBallotComplete(
  options: readonly PollOptionRef[],
  ballot: BallotVotes | null,
): boolean {
  if (!ballot) return false;
  const shape = pollShape(options);
  const ticked = new Set(ballot.optionIds);
  const tickedIn = (category: PollCategory) =>
    optionsIn(options, category).filter((option) => ticked.has(option.id)).length;

  if (shape.DATE === "vote") {
    const dates = tickedIn("DATE");
    if (ballot.noDateWorks ? dates > 0 : dates === 0) return false;
  }
  if (shape.PLACE === "vote" && tickedIn("PLACE") !== 1) return false;
  return true;
}
