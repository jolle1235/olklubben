import { describe, expect, it } from "vitest";

import { componentTextStyles, textStyles, textUtilities, type TextStyle } from "./typography";

/**
 * Typeskalaens regler (SPEC §13.3), efter Apples "The Details of UI
 * Typography": linjehøjde og tracking hører til størrelsen. Jo større
 * tekst, jo tættere linjer og jo strammere tracking; overskrifter strammes,
 * brødtekst får luft. De tætte og luftige varianter ligger på hver sin side
 * af rollens linjehøjde. Ændres en værdi i typography.ts, siger testen til her.
 */

const rem = (style: TextStyle) => {
  const match = /^(\d+(?:\.\d+)?)rem$/.exec(style.size);
  if (!match) throw new Error(`Ikke en rem-størrelse: ${style.size}`);
  return Number(match[1]);
};

const scale = Object.entries(textStyles)
  .map(([name, style]) => ({ name, ...style, rem: rem(style) }))
  .sort((a, b) => a.rem - b.rem);

describe("typeskalaen", () => {
  it("bruger rem, så teksten følger browserens skriftstørrelse", () => {
    for (const style of Object.values(textStyles)) expect(style.size).toMatch(/^\d+(\.\d+)?rem$/);
    for (const style of Object.values(componentTextStyles)) expect(style.size).toMatch(/rem/);
  });

  it("har ingen tekst under 0,75rem (12 px)", () => {
    expect(scale[0]!.rem).toBeGreaterThanOrEqual(0.75);
  });

  it("strammer linjehøjde og tracking, jo større teksten er (fra brødtekst og op)", () => {
    const fromBody = scale.filter((style) => style.rem >= 1);
    fromBody.slice(1).forEach((larger, i) => {
      const smaller = fromBody[i]!;
      const pair = `${larger.name} vs ${smaller.name}`;
      expect(larger.leading, pair).toBeLessThanOrEqual(smaller.leading);
      expect(larger.tracking, pair).toBeLessThanOrEqual(smaller.tracking);
    });
  });

  it("giver overskrifter (fra 1,25rem) negativ tracking og brødtekst 0", () => {
    for (const style of scale) {
      if (style.rem >= 1.25) expect(style.tracking, style.name).toBeLessThan(0);
      else expect(style.tracking, style.name).toBe(0);
    }
  });

  it("har en tæt variant under og en luftig over rollens egen linjehøjde", () => {
    for (const [name, style] of Object.entries(textStyles) as [string, TextStyle][]) {
      if (style.tight !== undefined) expect(style.tight, name).toBeLessThan(style.leading);
      if (style.loose !== undefined) expect(style.loose, name).toBeGreaterThan(style.leading);
    }
  });

  it("giver varianterne rollens størrelse og tracking og kun en anden linjehøjde", () => {
    const utilities = textUtilities();
    expect(utilities["body-sm-tight"]).toEqual({ size: "0.95rem", leading: 1.3, tracking: 0 });
    expect(utilities["body-lg-loose"]).toEqual({ size: "1.125rem", leading: 1.625, tracking: 0 });
    expect(utilities["display-xl-tight"]).toBeUndefined();
  });

  it("har unikke størrelser: to roller med samme størrelse er én rolle", () => {
    const sizes = scale.map((style) => style.size);
    expect(new Set(sizes).size).toBe(sizes.length);
  });
});
