import { describe, expect, it } from "vitest";

import { formatDanishList } from "./list";

describe("formatDanishList", () => {
  it("joins with commas and 'og'", () => {
    expect(formatDanishList([])).toBe("");
    expect(formatDanishList(["Mads"])).toBe("Mads");
    expect(formatDanishList(["Mads", "Anders"])).toBe("Mads og Anders");
    expect(formatDanishList(["Mads", "Anders", "Bo"])).toBe("Mads, Anders og Bo");
  });
});
