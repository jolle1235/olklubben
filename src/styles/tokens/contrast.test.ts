import { describe, expect, it } from "vitest";

import { createResolver, withHighContrast, type ColorValue, type Resolver } from "./resolve";
import { generateScales, THEMES, type Theme } from "./scales";
import { themeDefinition } from "./themes";

/** WCAG AA i begge temaer, også med høj kontrast (SPEC §13.2, §15.2). */

const TEXT = 4.5;
const NON_TEXT = 3;
const TEXT_AAA = 7;

const t = (name: string): ColorValue => ({ token: name });

type Pair = { fg: string; bg: string; min: number };

const FAMILIES = ["primary", "highlight", "info", "success", "destructive"] as const;
const SURFACES = ["frame", "feature"] as const;
const NEUTRAL_SURFACES = ["background", "card", "card-hover", "popover", "muted"] as const;

const pairs: Pair[] = [
  ...NEUTRAL_SURFACES.flatMap((bg) => [
    { fg: "foreground", bg, min: TEXT },
    { fg: "muted-foreground", bg, min: TEXT },
  ]),
  { fg: "card-foreground", bg: "card", min: TEXT },
  // Dæmpet tekst skifter til foreground ved hover (F-093).
  { fg: "foreground", bg: "muted-hover", min: TEXT },
  { fg: "popover-foreground", bg: "popover", min: TEXT },

  ...FAMILIES.flatMap((f) => [
    { fg: `${f}-foreground`, bg: f, min: TEXT },
    { fg: `${f}-foreground`, bg: `${f}-hover`, min: TEXT },
    ...[...NEUTRAL_SURFACES, `${f}-subtle`, `${f}-subtle-hover`].map((bg) => ({
      fg: `${f}-ink`,
      bg,
      min: TEXT,
    })),
    { fg: "foreground", bg: `${f}-subtle`, min: TEXT },
    { fg: "foreground", bg: `${f}-subtle-hover`, min: TEXT },
  ]),

  ...SURFACES.flatMap((s) => [
    ...[s, `${s}-hover`].flatMap((bg) => [
      { fg: `${s}-foreground`, bg, min: TEXT },
      { fg: `${s}-muted-foreground`, bg, min: TEXT },
    ]),
    { fg: `${s}-ring`, bg: s, min: NON_TEXT },
  ]),
  { fg: "feature-highlight", bg: "feature", min: TEXT },
  // Ikoner og stjerner på de mørke flader
  ...SURFACES.flatMap((s) => [
    { fg: "highlight", bg: s, min: NON_TEXT },
    { fg: "highlight", bg: `${s}-sunken`, min: NON_TEXT },
  ]),
  // Klubbadgens initialer er tekst
  { fg: "highlight", bg: "frame-sunken", min: TEXT },

  { fg: "secondary-foreground", bg: "secondary", min: TEXT },
  { fg: "secondary-foreground", bg: "secondary-hover", min: TEXT },
  { fg: "accent-foreground", bg: "accent", min: TEXT },

  ...["background", "card"].flatMap((bg) => [
    { fg: "border-strong", bg, min: NON_TEXT },
    { fg: "ring", bg, min: NON_TEXT },
  ]),

  ...[1, 2, 3, 4, 5].map((n) => ({ fg: "avatar-foreground", bg: `avatar-${n}`, min: TEXT })),
];

/** Kun med høj kontrast: dæmpet tekst næsten som brødtekst, kanter, der ses. */
const highContrastPairs: Pair[] = [
  ...NEUTRAL_SURFACES.map((bg) => ({ fg: "muted-foreground", bg, min: TEXT_AAA })),
  ...SURFACES.map((s) => ({ fg: `${s}-muted-foreground`, bg: s, min: TEXT_AAA })),
  ...["background", "card"].map((bg) => ({ fg: "border", bg, min: NON_TEXT })),
];

const scales = generateScales();
const normal = createResolver(themeDefinition, scales);
const highContrast = createResolver(withHighContrast(themeDefinition), scales);

function failures(list: Pair[], theme: Theme, resolver: Resolver) {
  return list
    .map((pair) => ({ ...pair, ratio: resolver.contrast(t(pair.fg), t(pair.bg), theme) }))
    .filter(({ ratio, min }) => ratio < min)
    .map(({ fg, bg, ratio, min }) => `${fg} på ${bg}: ${ratio.toFixed(2)} < ${min}`);
}

describe("farvesystemets kontrast (WCAG AA)", () => {
  it.each(THEMES)("alle par holder i %s tema", (theme) => {
    expect(failures(pairs, theme, normal)).toEqual([]);
  });

  it.each(THEMES)("alle par holder i %s tema med høj kontrast", (theme) => {
    expect(failures([...pairs, ...highContrastPairs], theme, highContrast)).toEqual([]);
  });
});
