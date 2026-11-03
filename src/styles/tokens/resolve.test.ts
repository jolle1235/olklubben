import { describe, expect, it } from "vitest";

import { createResolver, withHighContrast, type ThemeDefinition } from "./resolve";
import { generateScales } from "./scales";

const scales = generateScales();

const definition = (colors: ThemeDefinition["colors"]): ThemeDefinition => ({
  colors,
  vars: {},
  shadows: {},
});

describe("createResolver", () => {
  it("følger referencer til andre roller", () => {
    const resolver = createResolver(definition({ a: "harbor.9", b: { token: "a" } }), scales);
    expect(resolver.color({ token: "b" }, "light")).toEqual(resolver.color("harbor.9", "light"));
  });

  it("afviser ukendte roller og trin med det samme", () => {
    expect(() => createResolver(definition({ a: { token: "nope" } }), scales)).toThrow(/Ukendt/);
    expect(() => createResolver(definition({ a: "harbor.13" as "harbor.12" }), scales)).toThrow(
      /Ukendt trin/,
    );
  });

  it("afviser cirkulære roller, også dem kontrasttesten ikke nævner", () => {
    const loop = definition({
      a: { token: "b" },
      b: { mix: [{ token: "a" }, "black"], amount: 0.1 },
    });
    expect(() => createResolver(loop, scales)).toThrow(/Cirkulær/);
  });

  it("afviser en ukendt rolle i en skygge", () => {
    const shadow: ThemeDefinition = {
      ...definition({}),
      shadows: { raised: [{ geometry: "0 1px 2px", color: { token: "nope" } }] },
    };
    expect(() => createResolver(shadow, scales)).toThrow(/Ukendt rolle/);
  });

  it("vælger den faste tekstfarve med mest kontrast (auto)", () => {
    const resolver = createResolver(definition({}), scales);
    const light = resolver.color({ auto: "harbor.9" }, "light");
    const dark = resolver.color({ auto: "amber.9" }, "light");
    expect(light.mode === "rgb" && light.r > 0.9).toBe(true);
    expect(dark.mode === "rgb" && dark.r < 0.2).toBe(true);
  });

  it("skriver værdierne som CSS-variabler og color-mix()", () => {
    const resolver = createResolver(definition({ a: "harbor.9" }), scales);
    expect(resolver.css({ token: "a" }, "light")).toBe("var(--a)");
    expect(resolver.css({ mix: ["harbor.9", "black"], amount: 0.3 }, "light")).toBe(
      "color-mix(in oklab, var(--harbor-9), var(--black) 30%)",
    );
    expect(resolver.css({ alpha: 0.6, of: { token: "a" } }, "light")).toBe(
      "color-mix(in oklab, var(--a) 60%, transparent)",
    );
  });
});

describe("withHighContrast", () => {
  const base: ThemeDefinition = {
    ...definition({ text: "sand.11", border: "sand.6" }),
    highContrast: { text: "sand.12" },
  };

  it("lægger høj kontrast-rollerne oven på de andre", () => {
    expect(withHighContrast(base).colors).toEqual({ text: "sand.12", border: "sand.6" });
  });

  it("afviser en ukendt rolle", () => {
    expect(() => withHighContrast({ ...base, highContrast: { nope: "sand.12" } })).toThrow(
      /Ukendt rolle/,
    );
  });
});
