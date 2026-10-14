import { describe, expect, it } from "vitest";

import {
  closeReasonLabel,
  missingLabel,
  pollDateLabel,
  pollDateLongLabel,
  pollStatusLabel,
  tieHeadline,
  timeLeftLabel,
  votedSummaryLabel,
} from "./poll-labels";

const MIN = 60_000;
const HOUR = 60 * MIN;
const now = new Date("2026-10-14T10:00:00.000Z");
const plus = (ms: number) => new Date(now.getTime() + ms);

describe("timeLeftLabel", () => {
  it("counts days and hours, hours, minutes and passed", () => {
    expect(timeLeftLabel(plus(3 * 24 * HOUR + 4 * HOUR), now)).toBe("Frist om 3 dage, 4 timer");
    expect(timeLeftLabel(plus(24 * HOUR), now)).toBe("Frist om 1 dag");
    expect(timeLeftLabel(plus(25 * HOUR), now)).toBe("Frist om 1 dag, 1 time");
    expect(timeLeftLabel(plus(5 * HOUR + 59 * MIN), now)).toBe("Frist om 5 timer");
    expect(timeLeftLabel(plus(HOUR), now)).toBe("Frist om 1 time");
    expect(timeLeftLabel(plus(12 * MIN), now)).toBe("Frist om 12 minutter");
    expect(timeLeftLabel(plus(MIN), now)).toBe("Frist om 1 minut");
    expect(timeLeftLabel(plus(30_000), now)).toBe("Frist om under et minut");
    expect(timeLeftLabel(now, now)).toBe("Fristen er udløbet");
    expect(timeLeftLabel(plus(-HOUR), now)).toBe("Fristen er udløbet");
  });
});

describe("date labels (Europe/Copenhagen)", () => {
  it("formats an option short and long", () => {
    const startsAt = new Date("2026-11-14T17:30:00.000Z");
    expect(pollDateLabel(startsAt)).toBe("Lørdag 14/11 · 18:30");
    expect(pollDateLongLabel(startsAt)).toBe("lørdag 14. november kl. 18:30");
    expect(pollDateLabel(new Date("2026-10-24T16:30:00.000Z"))).toBe("Lørdag 24/10 · 18:30");
  });
});

describe("votedSummaryLabel / missingLabel", () => {
  it("counts the voters", () => {
    expect(votedSummaryLabel(6, 8)).toBe("6 af 8 har stemt");
  });

  it("lists who is missing with the viewer last as «dig»", () => {
    const people = [
      { id: "a", name: "Anders" },
      { id: "me", name: "Jesper", nickname: "Kaptajnen" },
      { id: "b", name: "Bo" },
    ];
    expect(missingLabel(people, "me")).toBe("Mangler: Anders, Bo og dig");
    expect(missingLabel(people, "x")).toBe("Mangler: Anders, Kaptajnen og Bo");
    expect(missingLabel([{ id: "me", name: "Jesper" }], "me")).toBe("Mangler: dig");
    expect(missingLabel([], "me")).toBe("");
  });
});

describe("tieHeadline / closeReasonLabel / pollStatusLabel", () => {
  it("names the tied categories", () => {
    expect(tieHeadline(["PLACE"])).toBe("Der er uafgjort om stedet 🤝");
    expect(tieHeadline(["DATE"])).toBe("Der er uafgjort om datoen 🤝");
    expect(tieHeadline(["DATE", "PLACE"])).toBe("Der er uafgjort om både datoen og stedet 🤝");
  });

  it("says why voting ended", () => {
    const deadline = new Date("2026-11-10T19:00:00.000Z");
    expect(closeReasonLabel({ closeReason: "ALL_VOTED", deadline, closedBy: null })).toBe(
      "Alle havde stemt.",
    );
    expect(closeReasonLabel({ closeReason: "DEADLINE", deadline, closedBy: null })).toBe(
      "Fristen udløb tirsdag 10. november kl. 20:00.",
    );
    expect(closeReasonLabel({ closeReason: "MANUAL", deadline, closedBy: { name: "Mads" } })).toBe(
      "Afsluttet af Mads.",
    );
    expect(closeReasonLabel({ closeReason: null, deadline, closedBy: null })).toBe("");
  });

  it("labels every status", () => {
    expect(pollStatusLabel("OPEN")).toBe("Åben");
    expect(pollStatusLabel("AWAITING_DECISION")).toBe("Uafgjort 🤝");
    expect(pollStatusLabel("CLOSED")).toBe("Afgjort");
    expect(pollStatusLabel("CANCELLED")).toBe("Annulleret");
  });
});
