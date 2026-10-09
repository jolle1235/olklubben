import { describe, expect, it } from "vitest";

import { eventTitleNumber, suggestEventTitle } from "./title";

describe("suggestEventTitle (SPEC §9.2, D-064)", () => {
  it("is 'Ølsmagning #N' with N = number of events + 1", () => {
    expect(suggestEventTitle(0)).toBe("Ølsmagning #1");
    expect(suggestEventTitle(12)).toBe("Ølsmagning #13");
  });

  it("treats bad counts as 0 and rounds down", () => {
    expect(suggestEventTitle(-3)).toBe("Ølsmagning #1");
    expect(suggestEventTitle(Number.NaN)).toBe("Ølsmagning #1");
    expect(suggestEventTitle(2.7)).toBe("Ølsmagning #3");
  });

  it("continues after the highest numbered title", () => {
    expect(suggestEventTitle(3, ["Ølsmagning #12", "Ølsmagning #13", "Juleøl warmup"])).toBe(
      "Ølsmagning #14",
    );
    expect(suggestEventTitle(5, ["Ølsmagning #2"])).toBe("Ølsmagning #6");
    expect(suggestEventTitle(0, [])).toBe("Ølsmagning #1");
  });
});

describe("eventTitleNumber", () => {
  it("reads the number of 'Ølsmagning #N' in any case and spacing", () => {
    expect(eventTitleNumber("Ølsmagning #14")).toBe(14);
    expect(eventTitleNumber("  ØLSMAGNING  # 7 ")).toBe(7);
  });

  it("ignores other titles", () => {
    for (const title of ["Juleøl warmup", "Ølsmagning #14 – tyske øl", "Ølsmagning", "#14"]) {
      expect(eventTitleNumber(title), title).toBeNull();
    }
  });
});
