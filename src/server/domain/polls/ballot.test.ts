import { describe, expect, it } from "vitest";

import { checkBallotChoice, isBallotComplete, type BallotChoice } from "./ballot";
import type { PollOptionRef } from "./options";

const d = (id: string): PollOptionRef => ({ id, category: "DATE" });
const p = (id: string): PollOptionRef => ({ id, category: "PLACE" });

const BOTH = [d("d1"), d("d2"), d("d3"), p("p1"), p("p2")];
const DATE_ONLY = [d("d1"), d("d2"), p("p1")];
const PLACE_ONLY = [d("d1"), p("p1"), p("p2")];
const FIXED = [d("d1"), p("p1")];

const choice = (overrides: Partial<BallotChoice> = {}): BallotChoice => ({
  dateOptionIds: [],
  noDateWorks: false,
  placeOptionId: null,
  ...overrides,
});

describe("checkBallotChoice (§9.7.2, D-013, D-134)", () => {
  it("stores dates and one place when both are voted on", () => {
    expect(
      checkBallotChoice(BOTH, choice({ dateOptionIds: ["d1", "d3"], placeOptionId: "p2" })),
    ).toEqual({
      ok: true,
      noDateWorks: false,
      votes: [
        { optionId: "d1", category: "DATE" },
        { optionId: "d3", category: "DATE" },
        { optionId: "p2", category: "PLACE" },
      ],
    });
  });

  it("accepts «Ingen af datoerne passer mig» instead of dates", () => {
    expect(checkBallotChoice(BOTH, choice({ noDateWorks: true, placeOptionId: "p1" }))).toEqual({
      ok: true,
      noDateWorks: true,
      votes: [{ optionId: "p1", category: "PLACE" }],
    });
  });

  it("removes duplicate ids", () => {
    const result = checkBallotChoice(
      BOTH,
      choice({ dateOptionIds: ["d2", "d2", "d1", "d2"], placeOptionId: "p1" }),
    );
    expect(result).toEqual({
      ok: true,
      noDateWorks: false,
      votes: [
        { optionId: "d2", category: "DATE" },
        { optionId: "d1", category: "DATE" },
        { optionId: "p1", category: "PLACE" },
      ],
    });
  });

  it("gives DATE_REQUIRED and PLACE_REQUIRED for an empty ballot", () => {
    expect(checkBallotChoice(BOTH, choice())).toEqual({
      ok: false,
      errors: { dateOptionIds: "DATE_REQUIRED", placeOptionId: "PLACE_REQUIRED" },
    });
    expect(checkBallotChoice(BOTH, choice({ placeOptionId: "" }))).toEqual({
      ok: false,
      errors: { dateOptionIds: "DATE_REQUIRED", placeOptionId: "PLACE_REQUIRED" },
    });
  });

  it("gives DATE_AND_NONE for dates together with «Ingen passer»", () => {
    expect(
      checkBallotChoice(
        BOTH,
        choice({ dateOptionIds: ["d1"], noDateWorks: true, placeOptionId: "p1" }),
      ),
    ).toEqual({ ok: false, errors: { dateOptionIds: "DATE_AND_NONE" } });
  });

  it("gives UNKNOWN_OPTION for an id outside the poll or in the other category", () => {
    expect(checkBallotChoice(BOTH, choice({ dateOptionIds: ["x"], placeOptionId: "p1" }))).toEqual({
      ok: false,
      errors: { dateOptionIds: "UNKNOWN_OPTION" },
    });
    expect(checkBallotChoice(BOTH, choice({ dateOptionIds: ["p1"], placeOptionId: "p1" }))).toEqual(
      { ok: false, errors: { dateOptionIds: "UNKNOWN_OPTION" } },
    );
    expect(checkBallotChoice(BOTH, choice({ dateOptionIds: ["d1"], placeOptionId: "d1" }))).toEqual(
      { ok: false, errors: { placeOptionId: "UNKNOWN_OPTION" } },
    );
  });

  it("drops the input of a fixed category (C8)", () => {
    // DATE fixed: dates and «Ingen passer» are ignored, only the place counts.
    expect(
      checkBallotChoice(
        PLACE_ONLY,
        choice({ dateOptionIds: ["d1", "forged"], noDateWorks: true, placeOptionId: "p2" }),
      ),
    ).toEqual({ ok: true, noDateWorks: false, votes: [{ optionId: "p2", category: "PLACE" }] });
    // PLACE fixed: the place is ignored, even a forged one.
    expect(
      checkBallotChoice(DATE_ONLY, choice({ dateOptionIds: ["d2"], placeOptionId: "forged" })),
    ).toEqual({ ok: true, noDateWorks: false, votes: [{ optionId: "d2", category: "DATE" }] });
    // Both fixed: an empty ballot is complete.
    expect(
      checkBallotChoice(FIXED, choice({ dateOptionIds: ["d1"], placeOptionId: "p1" })),
    ).toEqual({ ok: true, noDateWorks: false, votes: [] });
  });
});

describe("isBallotComplete (§9.7.2)", () => {
  const ballot = (optionIds: string[], noDateWorks = false) => ({
    userId: "u1",
    noDateWorks,
    optionIds,
  });

  it("is false for a missing ballot", () => {
    expect(isBallotComplete(BOTH, null)).toBe(false);
    expect(isBallotComplete(FIXED, null)).toBe(false);
  });

  it("only DATE votable: «Ingen passer» is complete, no dates is not", () => {
    expect(isBallotComplete(DATE_ONLY, ballot([], true))).toBe(true);
    expect(isBallotComplete(DATE_ONLY, ballot(["d1"]))).toBe(true);
    expect(isBallotComplete(DATE_ONLY, ballot([]))).toBe(false);
    expect(isBallotComplete(DATE_ONLY, ballot(["d1"], true))).toBe(false);
  });

  it("both votable: dates and a place are complete, dates without a place are not", () => {
    expect(isBallotComplete(BOTH, ballot(["d1", "d2", "p1"]))).toBe(true);
    expect(isBallotComplete(BOTH, ballot(["p1"], true))).toBe(true);
    expect(isBallotComplete(BOTH, ballot(["d1", "d2"]))).toBe(false);
    expect(isBallotComplete(BOTH, ballot(["d1", "p1", "p2"]))).toBe(false);
  });

  it("only PLACE votable: a place is complete", () => {
    expect(isBallotComplete(PLACE_ONLY, ballot(["p2"]))).toBe(true);
    expect(isBallotComplete(PLACE_ONLY, ballot([]))).toBe(false);
  });

  it("both fixed: any stored ballot is complete", () => {
    expect(isBallotComplete(FIXED, ballot([]))).toBe(true);
  });

  it("ignores ids that are not options of the poll", () => {
    expect(isBallotComplete(BOTH, ballot(["x", "p1"]))).toBe(false);
    expect(isBallotComplete(BOTH, ballot(["x", "d1", "p1"]))).toBe(true);
  });
});
