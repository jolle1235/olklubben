import { describe, expect, it } from "vitest";

import { createResolver, withHighContrast, type ThemeDefinition } from "./resolve";
import { generateScales } from "./scales";

// The real definition is valid, so only these tests show that the guards still fire.
const scales = generateScales();
const definition = (
  colors: ThemeDefinition["colors"],
  shadows: ThemeDefinition["shadows"] = {},
): ThemeDefinition => ({ colors, vars: {}, shadows });

describe("createResolver", () => {
  it("afviser ukendte roller og trin, også i skygger", () => {
    expect(() => createResolver(definition({ a: { token: "nope" } }), scales)).toThrow(/Ukendt/);
    expect(() => createResolver(definition({ a: "harbor.13" as "harbor.12" }), scales)).toThrow(
      /Ukendt trin/,
    );
    const shadow = { raised: [{ geometry: "0 1px 2px", color: { token: "nope" } }] };
    expect(() => createResolver(definition({}, shadow), scales)).toThrow(/Ukendt rolle/);
  });

  it("afviser cirkulære roller, også dem kontrasttesten ikke nævner", () => {
    const loop = definition({
      a: { token: "b" },
      b: { mix: [{ token: "a" }, "black"], amount: 0.1 },
    });
    expect(() => createResolver(loop, scales)).toThrow(/Cirkulær/);
  });
});

describe("withHighContrast", () => {
  it("afviser en ukendt rolle", () => {
    const base = { ...definition({ text: "sand.11" }), highContrast: { nope: "sand.12" as const } };
    expect(() => withHighContrast(base)).toThrow(/Ukendt rolle/);
  });
});
