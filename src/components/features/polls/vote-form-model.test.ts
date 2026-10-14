import { describe, expect, it } from "vitest";

import {
  placeHostsLabel,
  placeOptionLabel,
  placeOptionMeta,
  toPreviewVoter,
} from "./vote-form-model";

const creator = { name: "Jesper Dyrholm", nickname: "Jesper", isMember: true };

describe("place texts", () => {
  it("names who hosts if the place wins", () => {
    expect(placeHostsLabel(["Mads"], creator)).toBe("Mads bliver vært");
    expect(placeHostsLabel(["Mads", "Anders"], creator)).toBe("Mads og Anders bliver værter");
    expect(placeHostsLabel([], creator)).toBe("Ingen ejere – Jesper bliver vært");
    expect(placeHostsLabel([], { ...creator, isMember: false })).toBe("Ingen ejere endnu");
  });

  it("meta and label", () => {
    expect(placeOptionMeta({ address: "Søndergade 12", ownerNames: ["Mads"] }, creator)).toBe(
      "Søndergade 12 · Mads bliver vært",
    );
    expect(placeOptionMeta({ address: null, ownerNames: [] }, creator)).toBe(
      "Ingen ejere – Jesper bliver vært",
    );
    expect(placeOptionLabel({ name: "Hos Mads", archived: true })).toBe("Hos Mads (arkiveret)");
    expect(placeOptionLabel({ name: "Hos Mads", archived: false })).toBe("Hos Mads");
  });
});

describe("toPreviewVoter", () => {
  it("uses the display name and marks former members", () => {
    expect(
      toPreviewVoter({
        id: "u",
        name: "Mads Madsen",
        nickname: "Mads",
        image: null,
        isMember: false,
        isViewer: false,
      }),
    ).toEqual({ id: "u", name: "Mads", image: null, former: true });
  });
});
