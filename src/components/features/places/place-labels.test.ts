import { describe, expect, it } from "vitest";

import {
  ownersLabel,
  placeInActivePollNote,
  placeRemovalCopy,
  removeOwnerCopy,
  tastingCountLabel,
} from "./place-labels";

describe("ownersLabel", () => {
  it("says there are none, one or several owners", () => {
    expect(ownersLabel([])).toBe("Ingen ejere");
    expect(ownersLabel(["Mads"])).toBe("Ejer: Mads");
    expect(ownersLabel(["Mads", "Anders"])).toBe("Ejere: Mads og Anders");
    expect(ownersLabel(["Anders", "Kaptajnen", "Mads"])).toBe("Ejere: Anders, Kaptajnen og Mads");
  });
});

describe("tastingCountLabel", () => {
  it("counts the tastings at the place", () => {
    expect(tastingCountLabel(0)).toBe("Ikke brugt endnu");
    expect(tastingCountLabel(1)).toBe("1 ølsmagning");
    expect(tastingCountLabel(12)).toBe("12 ølsmagninger");
  });
});

describe("placeRemovalCopy", () => {
  it("deletes an unused place", () => {
    expect(placeRemovalCopy("delete", { eventCount: 0 })).toEqual({
      label: "Slet sted",
      description: "Stedet er ikke brugt til nogen ølsmagninger, så det bliver slettet helt.",
      pendingLabel: "Sletter …",
    });
  });

  it("archives a used place and says how often it was used", () => {
    const one = placeRemovalCopy("archive", { eventCount: 1 });
    expect(one.label).toBe("Arkivér sted");
    expect(one.pendingLabel).toBe("Arkiverer …");
    expect(one.description).toBe(
      "Stedet er brugt til 1 ølsmagning, så det bliver ikke slettet. Det forsvinder fra " +
        "listen, når I vælger sted, men de gamle events viser det stadig.",
    );
    expect(placeRemovalCopy("archive", { eventCount: 7 }).description).toMatch(
      /^Stedet er brugt til 7 ølsmagninger,/,
    );
  });
});

describe("places in polls (D-132, E5)", () => {
  it("archives a place that was only in polls, and says why", () => {
    expect(placeRemovalCopy("archive", { eventCount: 0 }).description).toBe(
      "Stedet har været med i en afstemning, så det bliver arkiveret i stedet for slettet. " +
        "Det forsvinder fra listen, når I vælger sted, men afstemningen viser det stadig.",
    );
  });

  it("explains why a place in an open poll cannot be removed", () => {
    expect(placeInActivePollNote("Ølsmagning #15")).toBe(
      "Stedet er med i afstemningen «Ølsmagning #15», så det kan ikke arkiveres, før den er afsluttet eller annulleret.",
    );
  });
});

describe("removeOwnerCopy", () => {
  it("names the owner and the place", () => {
    expect(removeOwnerCopy("Mads", "Hos Mads")).toEqual({
      title: "Fjern Mads som ejer af «Hos Mads»?",
      description: "Mads bliver ikke længere foreslået som vært her.",
    });
  });
});
