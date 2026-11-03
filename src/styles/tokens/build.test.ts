import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  generateScale,
  resolveColor,
  generateScales,
  withHighContrast,
  type ThemeDefinition,
} from "./build";
import { palette } from "./palette";
import { renderTokenFiles } from "./render";

describe("de genererede token-filer", () => {
  it.each(Object.entries(renderTokenFiles()))(
    "%s matcher palette.ts og themes.ts (kør `npm run tokens`)",
    (path, content) => {
      expect(readFileSync(path, "utf8")).toBe(content);
    },
  );
});

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

describe("resolveColor", () => {
  const scales = generateScales();
  const definition: ThemeDefinition = {
    colors: { a: "harbor.9", b: { token: "a" }, loop: { token: "loop" } },
    vars: {},
    shadows: {},
  };

  it("følger referencer til andre roller", () => {
    expect(resolveColor({ token: "b" }, "light", definition, scales)).toEqual(
      resolveColor("harbor.9", "light", definition, scales),
    );
  });

  it("afviser ukendte og cirkulære roller", () => {
    expect(() => resolveColor({ token: "nope" }, "light", definition, scales)).toThrow(/Ukendt/);
    expect(() => resolveColor({ token: "loop" }, "light", definition, scales)).toThrow(/Cirkulær/);
  });

  it("vælger den faste tekstfarve med mest kontrast (auto)", () => {
    const light = resolveColor({ auto: "harbor.9" }, "light", definition, scales);
    const dark = resolveColor({ auto: "amber.9" }, "light", definition, scales);
    expect(light.mode === "rgb" && light.r > 0.9).toBe(true);
    expect(dark.mode === "rgb" && dark.r < 0.2).toBe(true);
  });
});

describe("withHighContrast", () => {
  const definition: ThemeDefinition = {
    colors: { text: "sand.11", border: "sand.6" },
    vars: {},
    shadows: {},
    highContrast: { text: "sand.12" },
  };

  it("lægger høj kontrast-rollerne oven på de andre", () => {
    const contrast = withHighContrast(definition);
    expect(contrast.colors).toEqual({ text: "sand.12", border: "sand.6" });
  });

  it("afviser en ukendt rolle", () => {
    expect(() => withHighContrast({ ...definition, highContrast: { nope: "sand.12" } })).toThrow(
      /Ukendt rolle/,
    );
  });
});
