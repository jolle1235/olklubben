import { describe, expect, it } from "vitest";

import type { BallotVotes } from "./ballot";
import type { PollOptionRef } from "./options";
import { displayWinners, resolveWinner, tallyPoll, tiedCategories } from "./tally";

const d = (id: string): PollOptionRef => ({ id, category: "DATE" });
const p = (id: string): PollOptionRef => ({ id, category: "PLACE" });
const vote = (userId: string, optionIds: string[], noDateWorks = false): BallotVotes => ({
  userId,
  noDateWorks,
  optionIds,
});

const BOTH = [d("d1"), d("d2"), d("d3"), p("p1"), p("p2")];

describe("tallyPoll (§9.7.6, D-008, D-013)", () => {
  it("finds a clear winner in both categories", () => {
    const tally = tallyPoll(BOTH, [
      vote("a", ["d1", "d2", "p1"]),
      vote("b", ["d2", "p1"]),
      vote("c", ["d2", "d3", "p2"]),
    ]);
    expect(tally.date.mode).toBe("vote");
    expect(tally.date.options).toEqual([
      { optionId: "d1", count: 1, voterIds: ["a"] },
      { optionId: "d2", count: 3, voterIds: ["a", "b", "c"] },
      { optionId: "d3", count: 1, voterIds: ["c"] },
    ]);
    expect(tally.date.outcome).toEqual({ kind: "winner", optionId: "d2", count: 3 });
    expect(tally.place.outcome).toEqual({ kind: "winner", optionId: "p1", count: 2 });
    expect(tally.ballotCount).toBe(3);
    expect(tally.noDateWorksVoterIds).toEqual([]);
    expect(resolveWinner(tally)).toEqual({ ok: true, dateOptionId: "d2", placeOptionId: "p1" });
  });

  it("gives a date tie, a place tie and both", () => {
    const dateTie = tallyPoll(BOTH, [vote("a", ["d1", "p1"]), vote("b", ["d2", "p1"])]);
    expect(dateTie.date.outcome).toEqual({ kind: "tie", optionIds: ["d1", "d2"], count: 1 });
    expect(dateTie.place.outcome).toEqual({ kind: "winner", optionId: "p1", count: 2 });
    expect(tiedCategories(dateTie)).toEqual(["DATE"]);

    const placeTie = tallyPoll(BOTH, [vote("a", ["d1", "p1"]), vote("b", ["d1", "p2"])]);
    expect(placeTie.place.outcome).toEqual({ kind: "tie", optionIds: ["p1", "p2"], count: 1 });
    expect(resolveWinner(placeTie)).toEqual({ ok: false, reason: "TIE", tied: ["PLACE"] });

    const both = tallyPoll(BOTH, [vote("a", ["d1", "p1"]), vote("b", ["d2", "p2"])]);
    expect(tiedCategories(both)).toEqual(["DATE", "PLACE"]);
    expect(resolveWinner(both)).toEqual({ ok: false, reason: "TIE", tied: ["DATE", "PLACE"] });
  });

  it("with 0 ballots ties everything that is voted on, while a fixed category stays fixed (E9)", () => {
    const tally = tallyPoll([d("d1"), d("d2"), p("p1")], []);
    expect(tally.date.outcome).toEqual({ kind: "tie", optionIds: ["d1", "d2"], count: 0 });
    expect(tally.place.outcome).toEqual({ kind: "fixed", optionId: "p1" });
    expect(tally.ballotCount).toBe(0);
    expect(resolveWinner(tally)).toEqual({ ok: false, reason: "TIE", tied: ["DATE"] });
  });

  it("fixes a category with one option, also with votes on it", () => {
    const tally = tallyPoll([d("d1"), p("p1"), p("p2")], [vote("a", ["d1", "p2"])]);
    expect(tally.date.mode).toBe("fixed");
    expect(tally.date.outcome).toEqual({ kind: "fixed", optionId: "d1" });
    expect(tally.date.options).toEqual([{ optionId: "d1", count: 1, voterIds: ["a"] }]);
    expect(resolveWinner(tally)).toEqual({ ok: true, dateOptionId: "d1", placeOptionId: "p2" });
  });

  it("counts one person's three date ticks as three points", () => {
    const tally = tallyPoll(BOTH, [vote("a", ["d1", "d2", "d3", "p1"])]);
    expect(tally.date.options.map((o) => o.count)).toEqual([1, 1, 1]);
    expect(tally.date.outcome).toEqual({ kind: "tie", optionIds: ["d1", "d2", "d3"], count: 1 });
  });

  it("gives a tie at 0 when everyone chose «Ingen passer»", () => {
    const tally = tallyPoll(BOTH, [vote("a", ["p1"], true), vote("b", ["p1"], true)]);
    expect(tally.noDateWorksVoterIds).toEqual(["a", "b"]);
    expect(tally.date.outcome).toEqual({ kind: "tie", optionIds: ["d1", "d2", "d3"], count: 0 });
  });

  it("ignores a forged date tick next to «Ingen passer»", () => {
    const tally = tallyPoll(BOTH, [vote("a", ["d1", "p1"], true), vote("b", ["d2", "p1"])]);
    expect(tally.date.options.find((o) => o.optionId === "d1")?.count).toBe(0);
    expect(tally.date.outcome).toEqual({ kind: "winner", optionId: "d2", count: 1 });
  });

  it("counts only the first PLACE tick of a ballot", () => {
    const tally = tallyPoll(BOTH, [vote("a", ["d1", "p2", "p1"]), vote("b", ["d1", "p1"])]);
    expect(tally.place.options).toEqual([
      { optionId: "p1", count: 1, voterIds: ["b"] },
      { optionId: "p2", count: 1, voterIds: ["a"] },
    ]);
  });

  it("ignores unknown ids and double ticks", () => {
    const tally = tallyPoll(BOTH, [vote("a", ["zzz", "d1", "d1", "p1"])]);
    expect(tally.date.options[0]).toEqual({ optionId: "d1", count: 1, voterIds: ["a"] });
    expect(tally.date.outcome).toEqual({ kind: "winner", optionId: "d1", count: 1 });
  });
});

describe("resolveWinner (D-008)", () => {
  const tied = tallyPoll(BOTH, [vote("a", ["d1", "p1"]), vote("b", ["d1", "p2"])]);

  it("accepts a choice among the tied options", () => {
    expect(resolveWinner(tied, { PLACE: "p2" })).toEqual({
      ok: true,
      dateOptionId: "d1",
      placeOptionId: "p2",
    });
  });

  it("refuses an option that is not tied, or one from the other category", () => {
    const threeWay = tallyPoll(BOTH, [
      vote("a", ["d1", "d2", "p1"]),
      vote("b", ["d1", "d2", "p2"]),
    ]);
    expect(resolveWinner(threeWay, { DATE: "d3", PLACE: "p1" })).toEqual({
      ok: false,
      reason: "INVALID_CHOICE",
      categories: ["DATE"],
    });
    expect(resolveWinner(tied, { PLACE: "d1" })).toEqual({
      ok: false,
      reason: "INVALID_CHOICE",
      categories: ["PLACE"],
    });
  });

  it("refuses a resolution for a category that is not tied", () => {
    expect(resolveWinner(tied, { DATE: "d1", PLACE: "p1" })).toEqual({
      ok: false,
      reason: "INVALID_CHOICE",
      categories: ["DATE"],
    });
  });

  it("says TIE for a missing resolution", () => {
    expect(resolveWinner(tied, {})).toEqual({ ok: false, reason: "TIE", tied: ["PLACE"] });
  });
});

describe("displayWinners", () => {
  const tied = tallyPoll(BOTH, [vote("a", ["d1", "p1"]), vote("b", ["d1", "p2"])]);

  it("shows the decided options and null while tied", () => {
    expect(displayWinners(tied, {})).toEqual({ DATE: "d1", PLACE: null });
    expect(displayWinners(tied, { PLACE: "p2" })).toEqual({ DATE: "d1", PLACE: "p2" });
  });

  it("never throws, also for a stored resolution outside the tied set or an empty poll", () => {
    expect(displayWinners(tied, { PLACE: "nope", DATE: "d3" })).toEqual({
      DATE: "d1",
      PLACE: null,
    });
    expect(displayWinners(tallyPoll([], []), {})).toEqual({ DATE: null, PLACE: null });
  });
});
