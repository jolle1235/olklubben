import { describe, expect, it } from "vitest";

import {
  contrastOf,
  generateScales,
  THEMES,
  withHighContrast,
  type ColorValue,
  type ThemeDefinition,
} from "./build";
import { themeDefinition } from "./themes";

/**
 * WCAG AA for farvesystemet (SPEC §13.2, §15.2), i BEGGE temaer og med
 * høj kontrast slået til: tekst ≥ 4,5:1, ikoner, kanter og fokus ≥ 3:1.
 * Med høj kontrast skal dæmpet tekst desuden nå AAA (7:1) og almindelige
 * kanter 3:1. Erstatter den håndskrevne kontrasttabel: ændres en farve i
 * palette.ts eller en rolle i themes.ts, siger testen til her.
 */

const TEXT = 4.5;
const NON_TEXT = 3;
const TEXT_AAA = 7;

const t = (name: string): ColorValue => ({ token: name });

type Pair = { fg: string; bg: string; min: number };

const FAMILIES = ["primary", "highlight", "info", "success", "destructive"] as const;
const SURFACES = ["frame", "feature"] as const;
const NEUTRAL_SURFACES = ["background", "card", "popover", "muted"] as const;

const pairs: Pair[] = [
  // Brødtekst og dæmpet tekst på alle neutrale flader
  ...NEUTRAL_SURFACES.flatMap((bg) => [
    { fg: "foreground", bg, min: TEXT },
    { fg: "muted-foreground", bg, min: TEXT },
  ]),
  { fg: "card-foreground", bg: "card", min: TEXT },
  { fg: "popover-foreground", bg: "popover", min: TEXT },

  // Hver farvefamilie: tekst på den solide flade og farvet tekst på lyse flader
  ...FAMILIES.flatMap((f) => [
    { fg: `${f}-foreground`, bg: f, min: TEXT },
    { fg: `${f}-foreground`, bg: `${f}-hover`, min: TEXT },
    ...[...NEUTRAL_SURFACES, `${f}-subtle`, `${f}-subtle-hover`].map((bg) => ({
      fg: `${f}-ink`,
      bg,
      min: TEXT,
    })),
    // Brødtekst på de lyse farveflader (fx events i månedsgitteret)
    { fg: "foreground", bg: `${f}-subtle`, min: TEXT },
    { fg: "foreground", bg: `${f}-subtle-hover`, min: TEXT },
  ]),

  // Flader med egen tekst: tekst, dæmpet tekst og fokus, også i hover
  ...SURFACES.flatMap((s) => [
    ...[s, `${s}-hover`].flatMap((bg) => [
      { fg: `${s}-foreground`, bg, min: TEXT },
      { fg: `${s}-muted-foreground`, bg, min: TEXT },
    ]),
    { fg: `${s}-ring`, bg: s, min: NON_TEXT },
  ]),
  { fg: "feature-highlight", bg: "feature", min: TEXT },
  // Messing-ikoner og stjerner på mørke flader (det aktive nav-punkt, hero'ens ikoner, ikon-skiver)
  ...SURFACES.flatMap((s) => [
    { fg: "highlight", bg: s, min: NON_TEXT },
    { fg: "highlight", bg: `${s}-sunken`, min: NON_TEXT },
  ]),
  // Klubbadgens initialer (messing på den nedsænkede ramme)
  { fg: "highlight", bg: "frame-sunken", min: TEXT },

  // shadcn-aliaser
  { fg: "secondary-foreground", bg: "secondary", min: TEXT },
  { fg: "secondary-foreground", bg: "secondary-hover", min: TEXT },
  { fg: "accent-foreground", bg: "accent", min: TEXT },

  // Kanter, der skal ses, og fokus
  ...["background", "card"].flatMap((bg) => [
    { fg: "border-strong", bg, min: NON_TEXT },
    { fg: "ring", bg, min: NON_TEXT },
  ]),

  // Avatarernes initialer
  ...[1, 2, 3, 4, 5].map((n) => ({ fg: "avatar-foreground", bg: `avatar-${n}`, min: TEXT })),
];

/** Kun med høj kontrast: dæmpet tekst næsten som brødtekst, kanter, der ses. */
const highContrastPairs: Pair[] = [
  ...NEUTRAL_SURFACES.map((bg) => ({ fg: "muted-foreground", bg, min: TEXT_AAA })),
  ...SURFACES.map((s) => ({ fg: `${s}-muted-foreground`, bg: s, min: TEXT_AAA })),
  ...["background", "card"].map((bg) => ({ fg: "border", bg, min: NON_TEXT })),
];

const highContrast = withHighContrast(themeDefinition);

function failures(list: Pair[], theme: (typeof THEMES)[number], definition: ThemeDefinition) {
  const scales = generateScales();
  return list
    .map((pair) => ({
      ...pair,
      ratio: contrastOf(t(pair.fg), t(pair.bg), theme, definition, scales),
    }))
    .filter(({ ratio, min }) => ratio < min)
    .map(({ fg, bg, ratio, min }) => `${fg} på ${bg}: ${ratio.toFixed(2)} < ${min}`);
}

describe("farvesystemets kontrast (WCAG AA)", () => {
  it.each(THEMES)("alle par holder i %s tema", (theme) => {
    expect(failures(pairs, theme, themeDefinition)).toEqual([]);
  });

  it.each(THEMES)("alle par holder i %s tema med høj kontrast", (theme) => {
    expect(failures([...pairs, ...highContrastPairs], theme, highContrast)).toEqual([]);
  });

  it("dækker kun roller, der findes", () => {
    const names = new Set([
      ...Object.keys(themeDefinition.colors),
      ...Object.keys(themeDefinition.vars),
    ]);
    const unknown = pairs.flatMap(({ fg, bg }) => [fg, bg]).filter((name) => !names.has(name));
    expect(unknown).toEqual([]);
  });
});
