import { describe, expect, it } from "vitest";

import { ownersLabel, placeRemovalCopy, removeOwnerCopy, tastingCountLabel } from "./place-labels";

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
    expect(placeRemovalCopy("delete", 0)).toEqual({
      label: "Slet sted",
      description: "Stedet er ikke brugt til nogen ølsmagninger, så det bliver slettet helt.",
      pendingLabel: "Sletter …",
    });
  });

  it("archives a used place and says how often it was used", () => {
    const one = placeRemovalCopy("archive", 1);
    expect(one.label).toBe("Arkivér sted");
    expect(one.pendingLabel).toBe("Arkiverer …");
    expect(one.description).toBe(
      "Stedet er brugt til 1 ølsmagning, så det bliver ikke slettet. Det forsvinder fra " +
        "listen, når I vælger sted, men de gamle events viser det stadig.",
    );
    expect(placeRemovalCopy("archive", 7).description).toMatch(
      /^Stedet er brugt til 7 ølsmagninger,/,
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
