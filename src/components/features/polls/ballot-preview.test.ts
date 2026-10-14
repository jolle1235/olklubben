import { describe, expect, it } from "vitest";

import type { PollOptionRef } from "@/server/domain/polls/options";

import {
  draftFromBallot,
  EMPTY_DRAFT,
  isDraftDirty,
  previewNoDateWorks,
  previewOptions,
  setDraftNoDateWorks,
  setDraftPlace,
  toggleDraftDate,
  topCount,
  voteFormSchema,
  voterNames,
  votersSentence,
  type PreviewVoter,
} from "./ballot-preview";

const voter = (id: string, former = false): PreviewVoter => ({ id, name: id, image: null, former });
const ME = "me";
const MADS = voter("mads");
const ANDERS = voter("anders");
const ME_VOTER = voter(ME);

const D1 = "0199a000-0000-7000-8000-0000000000d1";
const D2 = "0199a000-0000-7000-8000-0000000000d2";
const P1 = "0199a000-0000-7000-8000-0000000000e1";
const P2 = "0199a000-0000-7000-8000-0000000000e2";

describe("draft", () => {
  it("starts from the saved ballot or empty", () => {
    expect(draftFromBallot(null)).toEqual(EMPTY_DRAFT);
    expect(draftFromBallot({ dateOptionIds: [D1], noDateWorks: false, placeOptionId: P1 })).toEqual(
      { dateOptionIds: [D1], noDateWorks: false, placeOptionId: P1 },
    );
  });

  it("is dirty only when it differs (date order does not matter)", () => {
    const saved = { dateOptionIds: [D1, D2], noDateWorks: false, placeOptionId: P1 };
    expect(isDraftDirty({ ...saved, dateOptionIds: [D2, D1] }, saved)).toBe(false);
    expect(isDraftDirty({ ...saved, dateOptionIds: [D1] }, saved)).toBe(true);
    expect(isDraftDirty({ ...saved, placeOptionId: P2 }, saved)).toBe(true);
    expect(isDraftDirty({ ...saved, dateOptionIds: [], noDateWorks: true }, saved)).toBe(true);
  });

  it("a date and «Ingen passer» exclude each other", () => {
    const none = setDraftNoDateWorks({ ...EMPTY_DRAFT, dateOptionIds: [D1, D2] }, true);
    expect(none).toEqual({ dateOptionIds: [], noDateWorks: true, placeOptionId: null });
    expect(toggleDraftDate(none, D1, true)).toEqual({
      dateOptionIds: [D1],
      noDateWorks: false,
      placeOptionId: null,
    });
    expect(
      toggleDraftDate({ ...EMPTY_DRAFT, dateOptionIds: [D1, D2] }, D1, false).dateOptionIds,
    ).toEqual([D2]);
    expect(setDraftNoDateWorks(none, false).noDateWorks).toBe(false);
    expect(setDraftPlace(EMPTY_DRAFT, P2).placeOptionId).toBe(P2);
  });
});

describe("previewOptions", () => {
  const options = [
    { id: D1, voters: [MADS, ME_VOTER] },
    { id: D2, voters: [ANDERS] },
  ];

  it("counts others + the viewer's current tick", () => {
    const rows = previewOptions({
      options,
      viewerId: ME,
      ticked: new Set([D2]),
      saved: new Set([D1]),
      mode: "vote",
    });
    expect(rows.map((r) => [r.count, r.viewer])).toEqual([
      [1, "none"],
      [2, "pending"],
    ]);
    expect(rows[0]?.others).toEqual([MADS]);
  });

  it("marks a saved tick as saved", () => {
    const rows = previewOptions({
      options,
      viewerId: ME,
      ticked: new Set([D1]),
      saved: new Set([D1]),
      mode: "vote",
    });
    expect(rows[0]).toMatchObject({ count: 2, viewer: "saved", isLeader: true, share: 1 });
    expect(rows[1]).toMatchObject({ count: 1, isLeader: false, share: 0.5 });
  });

  it("has no leader on a tie, at 0, or in a fixed category", () => {
    expect(
      previewOptions({
        options,
        viewerId: ME,
        ticked: new Set(),
        saved: new Set([D1]),
        mode: "vote",
      }).some((r) => r.isLeader),
    ).toBe(false);
    const empty = [
      { id: D1, voters: [] },
      { id: D2, voters: [] },
    ];
    const zero = previewOptions({
      options: empty,
      viewerId: ME,
      ticked: new Set(),
      saved: new Set(),
      mode: "vote",
    });
    expect(zero.map((r) => [r.isLeader, r.share])).toEqual([
      [false, 0],
      [false, 0],
    ]);
    const fixed = previewOptions({
      options: [{ id: P1, voters: [MADS] }],
      viewerId: ME,
      ticked: new Set(),
      saved: new Set(),
      mode: "fixed",
    });
    expect(fixed[0]?.isLeader).toBe(false);
  });

  it("keeps former members' votes", () => {
    const rows = previewOptions({
      options: [
        { id: P1, voters: [voter("gone", true)] },
        { id: P2, voters: [] },
      ],
      viewerId: ME,
      ticked: new Set([P2]),
      saved: new Set(),
      mode: "vote",
    });
    expect(rows.map((r) => r.count)).toEqual([1, 1]);
  });
});

describe("previewNoDateWorks", () => {
  it("previews the viewer and is never a leader", () => {
    const row = previewNoDateWorks({
      voters: [ANDERS],
      viewerId: ME,
      ticked: true,
      saved: false,
      dateTop: 4,
    });
    expect(row).toMatchObject({ count: 2, viewer: "pending", isLeader: false, share: 0.5 });
    expect(
      previewNoDateWorks({
        voters: [ANDERS, ME_VOTER],
        viewerId: ME,
        ticked: false,
        saved: true,
        dateTop: 0,
      }),
    ).toMatchObject({ count: 1, viewer: "none", share: 1 });
  });

  it("topCount", () => {
    const rows = previewOptions({
      options: [{ id: D1, voters: [MADS, ANDERS] }],
      viewerId: ME,
      ticked: new Set(),
      saved: new Set(),
      mode: "fixed",
    });
    expect(topCount(rows)).toBe(2);
    expect(topCount([])).toBe(0);
  });
});

describe("voteFormSchema", () => {
  const both: PollOptionRef[] = [
    { id: D1, category: "DATE" },
    { id: D2, category: "DATE" },
    { id: P1, category: "PLACE" },
    { id: P2, category: "PLACE" },
  ];
  const errorsOf = (options: PollOptionRef[], values: Record<string, unknown>) => {
    const result = voteFormSchema(options).safeParse(values);
    if (result.success) return null;
    return Object.fromEntries(
      result.error.issues.map((issue) => [issue.path.join("."), issue.message]),
    );
  };

  it("accepts a complete ballot", () => {
    expect(errorsOf(both, { dateOptionIds: [D1], placeOptionId: P1 })).toBeNull();
    expect(errorsOf(both, { dateOptionIds: [], noDateWorks: "on", placeOptionId: P2 })).toBeNull();
  });

  it("asks for a date and a place with the server's messages", () => {
    expect(errorsOf(both, { dateOptionIds: [] })).toEqual({
      dateOptionIds: "Sæt kryds ved mindst én dato, eller vælg «Ingen af datoerne passer mig».",
      placeOptionId: "Vælg et sted.",
    });
  });

  it("shows «both» once (the schema's own refine, F-056)", () => {
    const result = voteFormSchema(both).safeParse({
      dateOptionIds: [D1],
      noDateWorks: "on",
      placeOptionId: P1,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      "Vælg enten datoer eller «Ingen af datoerne passer mig».",
    ]);
  });

  it("needs nothing in a fixed category", () => {
    const fixedPlace: PollOptionRef[] = [
      { id: D1, category: "DATE" },
      { id: D2, category: "DATE" },
      { id: P1, category: "PLACE" },
    ];
    expect(errorsOf(fixedPlace, { dateOptionIds: [D2] })).toBeNull();
    const fixedDate: PollOptionRef[] = [
      { id: D1, category: "DATE" },
      { id: P1, category: "PLACE" },
      { id: P2, category: "PLACE" },
    ];
    expect(errorsOf(fixedDate, { placeOptionId: P2 })).toBeNull();
  });

  it("leaves an unknown option to the server", () => {
    expect(
      errorsOf(both, {
        dateOptionIds: ["0199a000-0000-7000-8000-0000000000ff"],
        placeOptionId: P1,
      }),
    ).toBeNull();
  });
});

describe("texts", () => {
  it("names the voters, the viewer last as dig", () => {
    expect(voterNames([MADS, ANDERS], "pending")).toEqual(["mads", "anders", "dig"]);
    expect(voterNames([MADS], "none")).toEqual(["mads"]);
  });

  it("sentences per row kind", () => {
    expect(votersSentence("date", { count: 3, others: [MADS, ANDERS], viewer: "saved" })).toBe(
      "3 kan: mads, anders og dig",
    );
    expect(votersSentence("place", { count: 1, others: [MADS], viewer: "none" })).toBe(
      "1 stemme: mads",
    );
    expect(votersSentence("place", { count: 2, others: [MADS, ANDERS], viewer: "none" })).toBe(
      "2 stemmer: mads og anders",
    );
    expect(votersSentence("none", { count: 1, others: [], viewer: "pending" })).toBe(
      "1 kan ingen af datoerne: dig",
    );
    expect(votersSentence("date", { count: 0, others: [], viewer: "none" })).toBe("Ingen endnu");
  });
});
