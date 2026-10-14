import { describe, expect, it } from "vitest";

import {
  deleteClubSummary,
  demoteCopy,
  genitive,
  placeCountLabel,
  promoteCopy,
  removeCopy,
} from "./club-labels";

describe("genitive", () => {
  it("s, x og z får en apostrof, andre bogstaver et s", () => {
    expect(genitive("Mads")).toBe("Mads'");
    expect(genitive("Max")).toBe("Max'");
    expect(genitive("Fritz")).toBe("Fritz'");
    expect(genitive("Jesper")).toBe("Jespers");
    expect(genitive("Kaptajnen")).toBe("Kaptajnens");
    expect(genitive("Søren Ø")).toBe("Søren Øs");
  });

  it("navne, der ikke ender på et bogstav, får 's", () => {
    expect(genitive("R2-D2")).toBe("R2-D2's");
    expect(genitive("Bo 🍺")).toBe("Bo 🍺's");
  });

  it("ignorerer mellemrum i enderne", () => {
    expect(genitive("  Mads  ")).toBe("Mads'");
  });
});

describe("placeCountLabel", () => {
  it("ental, flertal og ingen", () => {
    expect(placeCountLabel(0)).toBe("Ingen steder endnu");
    expect(placeCountLabel(1)).toBe("1 sted");
    expect(placeCountLabel(5)).toBe("5 steder");
  });
});

describe("deleteClubSummary with polls (round 4)", () => {
  it("adds the polls last, only when there are any", () => {
    expect(deleteClubSummary({ events: 14, beers: 0, ratings: 0, places: 5, polls: 2 })).toBe(
      "Alt i klubben bliver slettet permanent: 14 events, 5 steder og 2 afstemninger. " +
        "Medlemmernes konti bliver ikke slettet.",
    );
    expect(deleteClubSummary({ events: 0, beers: 0, ratings: 0, places: 0, polls: 1 })).toContain(
      ": 1 afstemning.",
    );
    expect(
      deleteClubSummary({ events: 1, beers: 0, ratings: 0, places: 0, polls: 0 }),
    ).not.toContain("afstemning");
  });
});

describe("deleteClubSummary", () => {
  it("nævner alt, der bliver slettet (D-103)", () => {
    expect(deleteClubSummary({ events: 14, beers: 37, ratings: 102, places: 5 })).toBe(
      "Alt i klubben bliver slettet permanent: 14 events, 37 øl med 102 ratings og 5 steder. Medlemmernes konti bliver ikke slettet.",
    );
  });

  it("bruger ental og udelader det, der ikke findes", () => {
    expect(deleteClubSummary({ events: 1, beers: 1, ratings: 1, places: 1 })).toBe(
      "Alt i klubben bliver slettet permanent: 1 event, 1 øl med 1 rating og 1 sted. Medlemmernes konti bliver ikke slettet.",
    );
    expect(deleteClubSummary({ events: 0, beers: 3, ratings: 0, places: 0 })).toBe(
      "Alt i klubben bliver slettet permanent: 3 øl. Medlemmernes konti bliver ikke slettet.",
    );
  });

  it("en tom klub", () => {
    expect(deleteClubSummary({ events: 0, beers: 0, ratings: 0, places: 0 })).toBe(
      "Alt i klubben bliver slettet permanent. Medlemmernes konti bliver ikke slettet.",
    );
  });

  it("tusinder med punktum", () => {
    expect(deleteClubSummary({ events: 0, beers: 1200, ratings: 0, places: 0 })).toContain(
      "1.200 øl",
    );
  });
});

describe("medlemsmenuens tekster", () => {
  it("gør til admin", () => {
    expect(promoteCopy("Mads")).toMatchObject({
      title: "Gør Mads til admin?",
      confirmLabel: "Gør til admin",
      done: "Mads er nu admin",
    });
  });

  it("fjern admin-rollen, også fra sig selv", () => {
    expect(demoteCopy("Mads", false)).toMatchObject({
      title: "Fjern Mads' admin-rolle?",
      done: "Mads er ikke længere admin",
    });
    expect(demoteCopy("Kaptajnen", true)).toMatchObject({
      title: "Fjern din admin-rolle?",
      confirmLabel: "Fjern min admin-rolle",
      done: "Du er ikke længere admin",
    });
  });

  it("fjern fra klubben forklarer, hvad der sker (§7.4)", () => {
    const copy = removeCopy("Mads", "Drengene & Bajere");
    expect(copy.title).toBe("Fjern Mads fra klubben?");
    expect(copy.description).toBe(
      "Mads mister adgangen til Drengene & Bajere med det samme. Mads' øl, ratings og tidligere events bliver i klubben. Mads fjernes som ejer af sine steder og som vært for kommende events.",
    );
    expect(copy.done).toBe("Mads er fjernet fra klubben");
  });
});
