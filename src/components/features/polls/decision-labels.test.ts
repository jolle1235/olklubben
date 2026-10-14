import { describe, expect, it } from "vitest";

import {
  cancelConfirmCopy,
  cancelledLabel,
  closeConfirmCopy,
  decidedCategoryLabel,
  hostsLabel,
  leaderLabel,
  managersNote,
  optionCountLabel,
  outcomeDateLabel,
  pollCardHeadline,
  pollCardMeta,
  pollCardState,
  resolvedByLabel,
  tieChoiceFormSchema,
  tieChoiceLegend,
  tiedOptionsLabel,
  tieWaitingNote,
} from "./decision-labels";

const NOW = new Date("2026-10-14T10:00:00Z");
// Saturday 21 November 2026, 18:30 Copenhagen (winter time, UTC+1).
const SAT = new Date("2026-11-21T17:30:00Z");
const ID_A = "0199a000-0000-7000-8000-00000000000a";
const ID_B = "0199a000-0000-7000-8000-00000000000b";

describe("confirmations", () => {
  it("close: says how many voted and what happens", () => {
    const copy = closeConfirmCopy(6, 8);
    expect(copy.title).toBe("Afslut afstemningen nu?");
    expect(copy.description).toBe(
      "6 af 8 har stemt. Stemmerne tælles op nu, og ingen kan stemme bagefter. Er der en klar vinder, bliver eventet oprettet med det samme.",
    );
    expect(copy.confirmLabel).toBe("Afslut nu");
    expect(copy.cancelLabel).toBe("Fortsæt afstemningen");
  });

  it("cancel: quotes the title, no event, votes stay", () => {
    const copy = cancelConfirmCopy("Ølsmagning #15");
    expect(copy.title).toBe("Annullér «Ølsmagning #15»?");
    expect(copy.description).toBe(
      "Der bliver ikke oprettet et event. Stemmerne bliver stående, så I kan se dem.",
    );
    expect(copy.confirmLabel).toBe("Annullér afstemning");
    expect(copy.cancelLabel).toBe("Behold den");
  });
});

describe("who decides (E11)", () => {
  it("names the creator while a member, else only the admins", () => {
    expect(managersNote({ name: "Mads", isMember: true })).toBe(
      "Mads (opretteren) og klubbens admins kan afslutte eller annullere afstemningen.",
    );
    expect(managersNote({ name: "Mads", isMember: false })).toBe(
      "Klubbens admins kan afslutte eller annullere afstemningen.",
    );
    expect(tieWaitingNote({ name: "Mads", isMember: true })).toBe(
      "Mads eller en admin vælger vinderen.",
    );
    expect(tieWaitingNote({ name: "Mads", isMember: false })).toBe("En admin vælger vinderen.");
  });
});

describe("the tie card", () => {
  it("legends and counts", () => {
    expect(tieChoiceLegend("DATE")).toBe("Hvilken dato bliver det?");
    expect(tieChoiceLegend("PLACE")).toBe("Hvilket sted bliver det?");
    expect(optionCountLabel("DATE", 5)).toBe("5 kan");
    expect(optionCountLabel("PLACE", 1)).toBe("1 stemme");
    expect(optionCountLabel("PLACE", 4)).toBe("4 stemmer");
  });

  it("lists the tied options", () => {
    expect(
      tiedOptionsLabel([
        { label: "Hos Mads", count: 4 },
        { label: "Hos Jesper", count: 4 },
      ]),
    ).toBe("Hos Mads 4 · Hos Jesper 4");
  });

  it("describes the category that is not tied", () => {
    expect(
      decidedCategoryLabel({ category: "DATE", label: "lørdag 21. november kl. 18:30", count: 5 }),
    ).toBe("Datoen er afgjort: lørdag 21. november kl. 18:30 (5 kan)");
    expect(decidedCategoryLabel({ category: "PLACE", label: "Hos Mads", count: 4 })).toBe(
      "Stedet er afgjort: Hos Mads (4 stemmer)",
    );
    expect(decidedCategoryLabel({ category: "PLACE", label: "Hos Mads", count: null })).toBe(
      "Stedet ligger fast: Hos Mads",
    );
  });
});

describe("tieChoiceFormSchema", () => {
  it("requires a choice for every tied category", () => {
    const result = tieChoiceFormSchema(["DATE", "PLACE"]).safeParse({});
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((issue) => issue.path.join("."));
    expect(paths).toEqual(["dateOptionId", "placeOptionId"]);
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      "Vælg en af de datoer, der står lige.",
      "Vælg et af de steder, der står lige.",
    ]);
  });

  it("passes with a choice, and ignores categories that are not tied", () => {
    expect(tieChoiceFormSchema(["PLACE"]).parse({ placeOptionId: ID_B })).toEqual({ PLACE: ID_B });
    expect(tieChoiceFormSchema(["DATE"]).parse({ dateOptionId: ID_A, placeOptionId: "" })).toEqual({
      DATE: ID_A,
    });
  });

  it("refuses a malformed id with the same message as the server", () => {
    const result = tieChoiceFormSchema(["PLACE"]).safeParse({ placeOptionId: "nope" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Vælg et af de steder, der står lige.");
  });
});

describe("the outcome", () => {
  it("dates and hosts", () => {
    expect(outcomeDateLabel(SAT, NOW)).toBe("Lørdag 21. november · 18:30");
    expect(outcomeDateLabel(new Date("2027-01-09T17:30:00Z"), NOW)).toBe(
      "Lørdag 9. januar 2027 · 18:30",
    );
    expect(hostsLabel(["Mads"])).toBe("Vært: Mads");
    expect(hostsLabel(["Anders", "Mads"])).toBe("Værter: Anders og Mads");
    expect(hostsLabel([])).toBe("Ingen vært endnu");
  });

  it("says who chose after a tie", () => {
    expect(resolvedByLabel([])).toBe("");
    expect(resolvedByLabel([{ category: "PLACE", chosenByName: "Mads" }])).toBe(
      "Mads valgte stedet, da det stod lige.",
    );
    expect(resolvedByLabel([{ category: "DATE", chosenByName: "Mads" }])).toBe(
      "Mads valgte datoen, da den stod lige.",
    );
    expect(
      resolvedByLabel([
        { category: "DATE", chosenByName: "Mads" },
        { category: "PLACE", chosenByName: "Mads" },
      ]),
    ).toBe("Mads valgte datoen og stedet, da de stod lige.");
  });

  it("the cancelled banner", () => {
    expect(cancelledLabel("Mads", new Date("2026-11-07T12:00:00Z"), NOW)).toBe(
      "Annulleret af Mads lørdag 7. november. Der blev ikke oprettet et event.",
    );
  });
});

describe("the Overblik card", () => {
  it("picks the state", () => {
    expect(pollCardState({ status: "OPEN", viewerHasVoted: false }, false)).toBe("missing");
    expect(pollCardState({ status: "OPEN", viewerHasVoted: true }, true)).toBe("voted");
    expect(pollCardState({ status: "AWAITING_DECISION", viewerHasVoted: true }, true)).toBe(
      "tie-manager",
    );
    expect(pollCardState({ status: "AWAITING_DECISION", viewerHasVoted: false }, false)).toBe(
      "tie-waiting",
    );
    expect(pollCardState({ status: "CLOSED", viewerHasVoted: false }, false)).toBe("decided");
  });

  it("headlines", () => {
    const mads = { name: "Mads", isMember: true };
    expect(pollCardHeadline("missing", mads, null, NOW)).toBe("Du mangler at stemme");
    expect(pollCardHeadline("voted", mads, null, NOW)).toBe("Du har stemt ✓");
    expect(pollCardHeadline("tie-manager", mads, null, NOW)).toBe(
      "Uafgjort 🤝 – du skal vælge vinderen",
    );
    expect(pollCardHeadline("tie-waiting", mads, null, NOW)).toBe(
      "Uafgjort 🤝 – Mads eller en admin vælger",
    );
    expect(pollCardHeadline("tie-waiting", { name: "Mads", isMember: false }, null, NOW)).toBe(
      "Uafgjort 🤝 – en admin vælger",
    );
    expect(pollCardHeadline("decided", mads, { startsAt: SAT, placeName: "Hos Mads" }, NOW)).toBe(
      "🎉 Afgjort: lørdag 21. november · Hos Mads",
    );
  });

  it("meta and leader", () => {
    expect(
      pollCardMeta(
        { deadline: new Date("2026-10-16T10:00:00Z"), votedCount: 5, memberCount: 8 },
        NOW,
      ),
    ).toBe("Frist om 2 dage · 5 af 8 har stemt");
    expect(leaderLabel({ startsAt: SAT, placeName: "Hos Mads" })).toBe(
      "Fører lige nu: lør 21/11 · Hos Mads",
    );
    expect(leaderLabel({ startsAt: null, placeName: "Hos Mads" })).toBe("Fører lige nu: Hos Mads");
    expect(leaderLabel(null)).toBe("Står lige lige nu");
  });
});
