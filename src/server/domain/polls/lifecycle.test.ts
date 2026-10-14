import { describe, expect, it } from "vitest";

import type { BallotVotes } from "./ballot";
import { isVotingOpen, shouldAutoClose, votedMemberIds } from "./lifecycle";
import type { PollOptionRef, PollStatus } from "./options";

const OPTIONS: PollOptionRef[] = [
  { id: "d1", category: "DATE" },
  { id: "d2", category: "DATE" },
  { id: "p1", category: "PLACE" },
  { id: "p2", category: "PLACE" },
];
const DEADLINE = new Date("2026-11-10T19:00:00.000Z");
const BEFORE = new Date(DEADLINE.getTime() - 1);
const complete = (userId: string): BallotVotes => ({
  userId,
  noDateWorks: false,
  optionIds: ["d1", "p1"],
});

function due(overrides: {
  status?: PollStatus;
  now?: Date;
  memberIds?: string[];
  ballots?: BallotVotes[];
}) {
  return shouldAutoClose({
    status: overrides.status ?? "OPEN",
    deadline: DEADLINE,
    now: overrides.now ?? BEFORE,
    options: OPTIONS,
    memberIds: new Set(overrides.memberIds ?? ["a", "b"]),
    ballots: overrides.ballots ?? [],
  });
}

describe("isVotingOpen", () => {
  it("is open while OPEN and before the deadline", () => {
    expect(isVotingOpen({ status: "OPEN", deadline: DEADLINE }, BEFORE)).toBe(true);
    expect(isVotingOpen({ status: "OPEN", deadline: DEADLINE }, DEADLINE)).toBe(false);
    expect(isVotingOpen({ status: "AWAITING_DECISION", deadline: DEADLINE }, BEFORE)).toBe(false);
    expect(isVotingOpen({ status: "CLOSED", deadline: DEADLINE }, BEFORE)).toBe(false);
  });
});

describe("shouldAutoClose (§9.7.5, E7, E8, E12)", () => {
  it("closes exactly at the deadline, not 1 ms before", () => {
    expect(due({ now: DEADLINE })).toBe("DEADLINE");
    expect(due({ now: BEFORE })).toBeNull();
  });

  it("prefers DEADLINE when everyone voted and it has expired", () => {
    expect(due({ now: DEADLINE, ballots: [complete("a"), complete("b")] })).toBe("DEADLINE");
  });

  it("closes when every current member has a complete ballot; one missing keeps it open", () => {
    expect(due({ ballots: [complete("a"), complete("b")] })).toBe("ALL_VOTED");
    expect(due({ ballots: [complete("a")] })).toBeNull();
  });

  it("does not let a former member's ballot fill a seat", () => {
    expect(due({ ballots: [complete("a"), complete("former")] })).toBeNull();
  });

  it("keeps it open for a new member without a ballot (E12)", () => {
    expect(
      due({ memberIds: ["a", "b", "new"], ballots: [complete("a"), complete("b")] }),
    ).toBeNull();
  });

  it("does not count an incomplete ballot", () => {
    expect(
      due({
        ballots: [complete("a"), { userId: "b", noDateWorks: false, optionIds: ["d1"] }],
      }),
    ).toBeNull();
  });

  it("never closes an empty roster by ALL_VOTED", () => {
    expect(due({ memberIds: [] })).toBeNull();
    expect(due({ memberIds: [], now: DEADLINE })).toBe("DEADLINE");
  });

  it("does nothing for a poll that is not OPEN", () => {
    for (const status of ["AWAITING_DECISION", "CLOSED", "CANCELLED"] as const) {
      expect(due({ status, now: DEADLINE })).toBeNull();
      expect(due({ status, ballots: [complete("a"), complete("b")] })).toBeNull();
    }
  });
});

describe("votedMemberIds", () => {
  it("returns current members with a complete ballot", () => {
    const voted = votedMemberIds(
      new Set(["a", "b", "c"]),
      [
        complete("a"),
        { userId: "b", noDateWorks: true, optionIds: ["p2"] },
        { userId: "c", noDateWorks: false, optionIds: [] },
        complete("gone"),
      ],
      OPTIONS,
    );
    expect([...voted].sort()).toEqual(["a", "b"]);
  });
});
