import { describe, expect, it } from "vitest";

import { findSimilarFeedback, type SimilarFeedbackCandidate } from "./similar";

const candidate = (
  id: string,
  title: string,
  overrides: Partial<SimilarFeedbackCandidate> = {},
): SimilarFeedbackCandidate => ({ id, title, status: "NEW", voteCount: 1, ...overrides });

const ids = (items: SimilarFeedbackCandidate[]) => items.map((item) => item.id);

describe("findSimilarFeedback (SPEC §9.9 'lignende rapporter')", () => {
  const candidates = [
    candidate("a", "Kalenderen viser forkert dato på mobil"),
    candidate("b", "Mørkt tema"),
    candidate("c", "Statistik over mest drukne øltype"),
    candidate("d", "Datoen i kalenderen er forkert"),
  ];

  it("matches words of at least 3 characters inside the candidates' title words", () => {
    expect(ids(findSimilarFeedback("kalender", candidates))).toEqual(["d", "a"]);
    expect(ids(findSimilarFeedback("Forkert DATO i kalenderen", candidates))).toEqual(["d", "a"]);
    expect(ids(findSimilarFeedback("mørkt", candidates))).toEqual(["b"]);
  });

  it("scores by the number of matched words", () => {
    const result = findSimilarFeedback("øltype statistik tema", candidates);
    expect(ids(result)).toEqual(["c", "b"]);
  });

  it("ignores case, NFC differences and Danish letters", () => {
    expect(ids(findSimilarFeedback("MØRKT", candidates))).toEqual(["b"]);
    // "å" typed as "a" + a combining ring (NFD) is the same word.
    const decomposed = "a\u030Angen";
    expect(ids(findSimilarFeedback(decomposed, [candidate("x", "Ængen og ången")]))).toEqual(["x"]);
  });

  it("finds nothing for a short title or one without a long enough word", () => {
    expect(findSimilarFeedback("", candidates)).toEqual([]);
    expect(findSimilarFeedback("ka", candidates)).toEqual([]);
    expect(findSimilarFeedback("a b c d e", candidates)).toEqual([]);
    expect(findSimilarFeedback("   ", candidates)).toEqual([]);
    expect(findSimilarFeedback("zzz", candidates)).toEqual([]);
  });

  it("puts open reports first on a tie, then the most votes, at most 3", () => {
    const tied = [
      candidate("done", "Login fejler", { status: "DONE", voteCount: 9 }),
      candidate("few", "Login fejler igen", { status: "NEW", voteCount: 1 }),
      candidate("many", "Login fejler altid", { status: "PLANNED", voteCount: 4 }),
      candidate("dup", "Login fejler stadig", { status: "DUPLICATE", voteCount: 2 }),
      candidate("prog", "Login fejler nogle gange", { status: "IN_PROGRESS", voteCount: 2 }),
    ];
    expect(ids(findSimilarFeedback("login", tied))).toEqual(["many", "prog", "few"]);
    expect(ids(findSimilarFeedback("login", tied, 10))).toEqual([
      "many",
      "prog",
      "few",
      "done",
      "dup",
    ]);
    expect(findSimilarFeedback("login", tied, 0)).toEqual([]);
  });

  it("returns the candidates themselves (extra fields kept)", () => {
    const extra = [{ ...candidate("x", "Kalenderen"), href: "/feedback/x" }];
    expect(findSimilarFeedback("kalender", extra)[0]?.href).toBe("/feedback/x");
  });
});
