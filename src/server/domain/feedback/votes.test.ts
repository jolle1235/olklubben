import { describe, expect, it } from "vitest";

import { compareFeedbackByVotes, feedbackVoteCount } from "./votes";

describe("feedbackVoteCount (SPEC §9.9, §3.4, D-144)", () => {
  it("counts the author as 1 plus every vote", () => {
    expect(feedbackVoteCount(0)).toBe(1);
    expect(feedbackVoteCount(1)).toBe(2);
    expect(feedbackVoteCount(6)).toBe(7);
  });
});

describe("compareFeedbackByVotes", () => {
  const at = (day: number) => new Date(Date.UTC(2026, 9, day));

  it("sorts by votes, then newest, then id descending", () => {
    const items = [
      { id: "a", voteCount: 2, createdAt: at(1) },
      { id: "b", voteCount: 5, createdAt: at(1) },
      { id: "c", voteCount: 2, createdAt: at(3) },
      { id: "d", voteCount: 2, createdAt: at(3) },
      { id: "e", voteCount: 1, createdAt: at(9) },
    ];
    expect([...items].sort(compareFeedbackByVotes).map((item) => item.id)).toEqual([
      "b",
      "d",
      "c",
      "a",
      "e",
    ]);
  });

  it("is 0 only for the same report", () => {
    const item = { id: "x", voteCount: 3, createdAt: at(2) };
    expect(compareFeedbackByVotes(item, { ...item })).toBe(0);
  });
});
