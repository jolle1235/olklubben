import { describe, expect, it } from "vitest";

import {
  ACTIVE_POLL_STATUSES,
  DEFAULT_POLL_DEADLINE_TIME,
  DEFAULT_POLL_START_TIME,
  hasSomethingToVoteOn,
  isActivePollStatus,
  optionsIn,
  pollShape,
  type PollOptionRef,
} from "./options";

const d = (id: string): PollOptionRef => ({ id, category: "DATE" });
const p = (id: string): PollOptionRef => ({ id, category: "PLACE" });

describe("pollShape (§9.7.1)", () => {
  it("votes on a category with more than one option and fixes one with exactly one", () => {
    expect(pollShape([d("d1"), d("d2"), p("p1")])).toEqual({ DATE: "vote", PLACE: "fixed" });
    expect(pollShape([d("d1"), p("p1"), p("p2")])).toEqual({ DATE: "fixed", PLACE: "vote" });
    expect(pollShape([d("d1"), d("d2"), p("p1"), p("p2")])).toEqual({
      DATE: "vote",
      PLACE: "vote",
    });
    expect(pollShape([d("d1"), p("p1")])).toEqual({ DATE: "fixed", PLACE: "fixed" });
  });

  it("treats an empty category as fixed (never stored, but never voted on either)", () => {
    expect(pollShape([])).toEqual({ DATE: "fixed", PLACE: "fixed" });
  });

  it("optionsIn keeps the input order", () => {
    expect(optionsIn([d("d2"), p("p1"), d("d1")], "DATE").map((o) => o.id)).toEqual(["d2", "d1"]);
  });
});

describe("hasSomethingToVoteOn (D-134)", () => {
  it("needs one of each and two in at least one category", () => {
    expect(hasSomethingToVoteOn(2, 1)).toBe(true);
    expect(hasSomethingToVoteOn(1, 2)).toBe(true);
    expect(hasSomethingToVoteOn(10, 10)).toBe(true);
    expect(hasSomethingToVoteOn(1, 1)).toBe(false);
    expect(hasSomethingToVoteOn(0, 3)).toBe(false);
    expect(hasSomethingToVoteOn(3, 0)).toBe(false);
  });
});

describe("constants", () => {
  it("has the active statuses and the default times", () => {
    expect(ACTIVE_POLL_STATUSES).toEqual(["OPEN", "AWAITING_DECISION"]);
    expect(isActivePollStatus("OPEN")).toBe(true);
    expect(isActivePollStatus("AWAITING_DECISION")).toBe(true);
    expect(isActivePollStatus("CLOSED")).toBe(false);
    expect(isActivePollStatus("CANCELLED")).toBe(false);
    expect(DEFAULT_POLL_START_TIME).toBe("18:30");
    expect(DEFAULT_POLL_DEADLINE_TIME).toBe("20:00");
  });
});
