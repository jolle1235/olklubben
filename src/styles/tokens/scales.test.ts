import { describe, expect, it } from "vitest";

import { palette } from "./palette";
import { generateScale } from "./scales";

describe("generateScale", () => {
  it("lægger basen på trin 9 og de låste trin ovenpå", () => {
    const scale = generateScale({ base: "#3E5568", light: { 3: "#DCE6EE" } }, "light");
    expect(scale[9]).toBe("#3e5568");
    expect(scale[3]).toBe("#dce6ee");
  });

  it("bruger darkBase som trin 9 i mørkt tema", () => {
    expect(generateScale({ base: "#414437", darkBase: "#a4a985" }, "dark")[9]).toBe("#a4a985");
  });

  it("går fra lyst til mørkt i lyst tema og omvendt i mørkt (trin 1–8)", () => {
    const luminance = (hex: string) => parseInt(hex.slice(1, 3), 16);
    for (const theme of ["light", "dark"] as const) {
      const scale = generateScale(palette.harbor, theme);
      const reds = [1, 2, 4, 5, 6, 7, 8].map((step) => luminance(scale[step as 1]));
      const sorted = [...reds].sort((a, b) => (theme === "light" ? b - a : a - b));
      expect(reds).toEqual(sorted);
    }
  });
});
