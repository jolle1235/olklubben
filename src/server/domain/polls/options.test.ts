import { describe, expect, it } from "vitest";

import {
  ACTIVE_POLL_STATUSES,
  DEFAULT_POLL_DEADLINE_TIME,
  DEFAULT_POLL_START_TIME,
  diffPollOptions,
  hasSomethingToVoteOn,
  isActivePollStatus,
  optionsIn,
  pollShape,
  type PollOptionRef,
  type StoredPollOption,
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

describe("diffPollOptions (D-153)", () => {
  const NOV_14 = new Date("2026-11-14T17:30:00.000Z");
  const NOV_21 = new Date("2026-11-21T17:30:00.000Z");
  const NOV_28 = new Date("2026-11-28T17:30:00.000Z");
  const date = (id: string, startsAt: Date | null): StoredPollOption => ({
    id,
    category: "DATE",
    startsAt,
    placeId: null,
  });
  const place = (id: string, placeId: string | null): StoredPollOption => ({
    id,
    category: "PLACE",
    startsAt: null,
    placeId,
  });
  const current = [date("d14", NOV_14), date("d21", NOV_21), place("pA", "A"), place("pB", "B")];

  it("keeps unchanged options, removes the rest and adds what is missing", () => {
    expect(
      diffPollOptions(current, { dates: [NOV_21, NOV_28], placeIds: ["B", "C", "A"] }),
    ).toEqual({ removedIds: ["d14"], addedDates: [NOV_28], addedPlaceIds: ["C"] });
  });

  it("changes nothing when the options are the same", () => {
    expect(
      diffPollOptions(current, {
        dates: [new Date(NOV_21.getTime()), NOV_14],
        placeIds: ["A", "B"],
      }),
    ).toEqual({ removedIds: [], addedDates: [], addedPlaceIds: [] });
  });

  it("replaces every date when the start time moves", () => {
    const later = (instant: Date) => new Date(instant.getTime() + 60 * 60 * 1000);
    expect(
      diffPollOptions(current, { dates: [later(NOV_14), later(NOV_21)], placeIds: ["A", "B"] }),
    ).toEqual({
      removedIds: ["d14", "d21"],
      addedDates: [later(NOV_14), later(NOV_21)],
      addedPlaceIds: [],
    });
  });

  it("counts a repeated wish once and removes stored duplicates and broken rows", () => {
    const messy = [...current, date("d14b", NOV_14), date("dnull", null), place("pnull", null)];
    expect(
      diffPollOptions(messy, { dates: [NOV_14, NOV_14, NOV_28, NOV_28], placeIds: ["A", "A"] }),
    ).toEqual({
      removedIds: ["d21", "pB", "d14b", "dnull", "pnull"],
      addedDates: [NOV_28],
      addedPlaceIds: [],
    });
  });

  it("never keeps a date as a place or a place as a date", () => {
    const odd: StoredPollOption = { id: "x", category: "PLACE", startsAt: NOV_14, placeId: null };
    expect(diffPollOptions([odd], { dates: [NOV_14], placeIds: [] })).toEqual({
      removedIds: ["x"],
      addedDates: [NOV_14],
      addedPlaceIds: [],
    });
  });
});
