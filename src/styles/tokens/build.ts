import {
  blend,
  converter,
  formatHex,
  interpolate,
  toGamut,
  wcagContrast,
  type Color,
} from "culori";

import {
  constants,
  palette,
  STEPS,
  type Constant,
  type Hue,
  type ScaleInput,
  type Step,
} from "./palette";
import { capsTracking, componentTextStyles, textStyles, type TextStyle } from "./typography";

/**
 * Farvesystemets motor (SPEC §13.2): genererer skalaerne i palette.ts,
 * opløser rollerne i themes.ts og skriver tokens.css, sammen med
 * typeskalaen fra typography.ts (§13.3). Køres af
 * `npm run tokens` (scripts/build-tokens.ts) og af testene; aldrig i appen
 * (culori er en devDependency).
 */

export type Theme = "light" | "dark";
export const THEMES: readonly Theme[] = ["light", "dark"];

/** Et skalatrin ("olive.9") eller en fast farve ("fixed-light"). */
export type Ref = `${Hue}.${Step}` | Constant;

/**
 * En farveværdi i themes.ts:
 *   "olive.9"                     et skalatrin (skifter med temaet)
 *   { token: "primary" }          en anden rolle
 *   { mix: [a, b], amount: 0.1 }  10 % b blandet i a (OKLab), fx hover-tilstande
 *   { alpha: 0.5, of: a }         a med 50 % dækkeevne, fx overlays og skygger
 *   { auto: a }                   den faste lyse eller mørke tekstfarve, der giver
 *                                 mest kontrast mod a (tekst på solide flader)
 */
export type ColorValue =
  | Ref
  | { token: string }
  | { mix: readonly [ColorValue, ColorValue]; amount: number }
  | { alpha: number; of: ColorValue }
  | { auto: ColorValue };

/** En værdi, der er ens i begge temaer, eller én pr. tema. */
export type ThemedValue = ColorValue | { light: ColorValue; dark: ColorValue };

/** Ét skygge-lag: geometrien ("0 10px 24px -20px", evt. "inset …") og farven. */
export type ShadowLayer = { geometry: string; color: ColorValue };

export type ThemeDefinition = {
  /** Roller, der bliver Tailwind-utilities (bg-*, text-*, border-* …). */
  colors: Record<string, ThemedValue>;
  /** Komponent-variabler, der kun findes som CSS-variabler (fx porthole-ringen). */
  vars: Record<string, ThemedValue>;
  /** Elevation: `--elevation-<navn>` og utility'en `shadow-<navn>`. */
  shadows: Record<string, readonly ShadowLayer[]>;
  /**
   * Høj kontrast (`prefers-contrast: more`, fx "Øg kontrast" på iPhone):
   * roller i `colors`/`vars`, der får en anden værdi, når systemet beder om
   * mere kontrast. Gælder i begge temaer.
   */
  highContrast?: Record<string, ThemedValue>;
};

// ---------------------------------------------------------------------------
// Lag 1: skalaer

const toOklch = converter("oklch");
const toRgb = converter("rgb");
const intoGamut = toGamut("rgb", "oklch");

/**
 * Lyshed (OKLCH L) og mætning (andel af basens chroma) pr. trin. Trin 9 er
 * basen selv; trin 10 og 11 regnes ud fra den (se generateScale).
 */
const CURVES: Record<Theme, { lightness: Record<number, number>; chroma: number[] }> = {
  light: {
    lightness: {
      1: 0.99,
      2: 0.975,
      3: 0.945,
      4: 0.915,
      5: 0.885,
      6: 0.85,
      7: 0.8,
      8: 0.72,
      12: 0.27,
    },
    chroma: [0.1, 0.18, 0.32, 0.42, 0.52, 0.6, 0.7, 0.85, 1, 1, 0.9, 0.55],
  },
  dark: {
    lightness: {
      1: 0.17,
      2: 0.205,
      3: 0.245,
      4: 0.275,
      5: 0.305,
      6: 0.345,
      7: 0.405,
      8: 0.52,
      11: 0.8,
      12: 0.94,
    },
    chroma: [0.22, 0.28, 0.42, 0.5, 0.55, 0.6, 0.68, 0.8, 1, 1, 0.7, 0.3],
  },
};

function hex(color: Color): string {
  return formatHex(intoGamut(color));
}

/** De 12 trin i ét tema: genereret ud fra basen, med de låste trin lagt ovenpå. */
export function generateScale(input: ScaleInput, theme: Theme): Record<Step, string> {
  const baseHex = theme === "dark" ? (input.darkBase ?? input.base) : input.base;
  const base = toOklch(baseHex);
  if (!base) throw new Error(`Ugyldig farve: ${baseHex}`);
  const curve = CURVES[theme];
  const hue = base.h ?? 0;

  const lightnessOf = (step: Step): number => {
    if (step === 9) return base.l;
    if (step === 10) return theme === "light" ? base.l - 0.04 : base.l + 0.04;
    // Farvet tekst på lyse flader: aldrig lysere end basen, højst L 0,5 (≥ 4,5:1 på trin 1–3).
    if (step === 11 && theme === "light") return Math.min(0.5, base.l);
    return curve.lightness[step]!;
  };

  const pinned = (theme === "light" ? input.light : input.dark) ?? {};
  const scale = {} as Record<Step, string>;
  for (const step of STEPS) {
    scale[step] =
      pinned[step]?.toLowerCase() ??
      (step === 9
        ? baseHex.toLowerCase()
        : hex({
            mode: "oklch",
            l: lightnessOf(step),
            c: base.c * curve.chroma[step - 1]!,
            h: hue,
          }));
  }
  return scale;
}

export type Scales = Record<Theme, Record<Hue, Record<Step, string>>>;

export function generateScales(): Scales {
  const result = { light: {}, dark: {} } as Scales;
  for (const theme of THEMES) {
    for (const hue of Object.keys(palette) as Hue[]) {
      result[theme][hue] = generateScale(palette[hue], theme);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Lag 2–3: roller

function isThemed(value: ThemedValue): value is { light: ColorValue; dark: ColorValue } {
  return typeof value === "object" && "light" in value && "dark" in value;
}

export function valueFor(value: ThemedValue, theme: Theme): ColorValue {
  return isThemed(value) ? value[theme] : value;
}

function isConstant(ref: string): ref is Constant {
  return ref in constants;
}

function splitRef(ref: `${Hue}.${Step}`): [Hue, Step] {
  const [hue, step] = ref.split(".");
  if (!hue || !(hue in palette)) throw new Error(`Ukendt skala i "${ref}"`);
  const n = Number(step);
  if (!STEPS.includes(n as Step)) throw new Error(`Ukendt trin i "${ref}"`);
  return [hue as Hue, n as Step];
}

/** Opslag af alle roller (colors + vars) på navn. */
function allTokens(definition: ThemeDefinition): Record<string, ThemedValue> {
  return { ...definition.colors, ...definition.vars };
}

/** Farven en værdi ender med i et tema (sRGB, evt. med alfa). Bruges af kontrasttesten. */
export function resolveColor(
  value: ColorValue,
  theme: Theme,
  definition: ThemeDefinition,
  scales: Scales,
  seen: string[] = [],
): Color {
  if (typeof value === "string") {
    if (isConstant(value)) return toRgb(constants[value])!;
    const [hue, step] = splitRef(value);
    return toRgb(scales[theme][hue][step])!;
  }
  if ("token" in value) {
    const target = allTokens(definition)[value.token];
    if (!target) throw new Error(`Ukendt rolle "${value.token}"`);
    if (seen.includes(value.token))
      throw new Error(`Cirkulær rolle: ${[...seen, value.token].join(" → ")}`);
    return resolveColor(valueFor(target, theme), theme, definition, scales, [...seen, value.token]);
  }
  if ("mix" in value) {
    const a = resolveColor(value.mix[0], theme, definition, scales, seen);
    const b = resolveColor(value.mix[1], theme, definition, scales, seen);
    return toRgb(interpolate([a, b], "oklab")(value.amount));
  }
  if ("alpha" in value) {
    const color = resolveColor(value.of, theme, definition, scales, seen);
    return { ...toRgb(color), alpha: (color.alpha ?? 1) * value.alpha };
  }
  return toRgb(constants[autoForeground(value.auto, theme, definition, scales, seen)])!;
}

/** Den faste tekstfarve (lys eller mørk), der giver mest kontrast mod fladen. */
function autoForeground(
  surface: ColorValue,
  theme: Theme,
  definition: ThemeDefinition,
  scales: Scales,
  seen: string[],
): Constant {
  const background = resolveColor(surface, theme, definition, scales, seen);
  return wcagContrast(constants["fixed-light"], background) >=
    wcagContrast(constants["fixed-dark"], background)
    ? "fixed-light"
    : "fixed-dark";
}

/** Lægger en (evt. gennemsigtig) farve oven på en uigennemsigtig baggrund. */
export function composite(color: Color, background: Color): Color {
  if ((color.alpha ?? 1) >= 1) return color;
  return toRgb(blend([background, color], "normal"));
}

/** WCAG-kontrasten mellem to roller i et tema (forgrunden lægges på baggrunden). */
export function contrastOf(
  foreground: ColorValue,
  background: ColorValue,
  theme: Theme,
  definition: ThemeDefinition,
  scales: Scales,
): number {
  const bg = resolveColor(background, theme, definition, scales);
  const fg = resolveColor(foreground, theme, definition, scales);
  return wcagContrast(composite(fg, bg), bg);
}

/** Opløst hex for en rolle i et tema (fx browserens statusbarfarve). */
export function resolvedHex(
  token: string,
  theme: Theme,
  definition: ThemeDefinition,
  scales: Scales,
): string {
  return formatHex(resolveColor({ token }, theme, definition, scales));
}

/** Definitionen, som den ser ud ved høj kontrast (rollerne i `highContrast` lagt ovenpå). */
export function withHighContrast(definition: ThemeDefinition): ThemeDefinition {
  const overrides = definition.highContrast ?? {};
  const pick = (group: Record<string, ThemedValue>) =>
    Object.fromEntries(
      Object.entries(group).map(([name, value]) => [name, overrides[name] ?? value]),
    );
  for (const name of Object.keys(overrides)) {
    if (!(name in allTokens(definition))) throw new Error(`Ukendt rolle i highContrast: "${name}"`);
  }
  return {
    ...definition,
    colors: pick(definition.colors),
    vars: pick(definition.vars),
    highContrast: {},
  };
}

// ---------------------------------------------------------------------------
// CSS

function cssValue(
  value: ColorValue,
  theme: Theme,
  definition: ThemeDefinition,
  scales: Scales,
): string {
  if (typeof value === "string") {
    return isConstant(value) ? `var(--${value})` : `var(--${value.replace(".", "-")})`;
  }
  if ("token" in value) {
    if (!(value.token in allTokens(definition))) throw new Error(`Ukendt rolle "${value.token}"`);
    return `var(--${value.token})`;
  }
  if ("mix" in value) {
    const a = cssValue(value.mix[0], theme, definition, scales);
    const b = cssValue(value.mix[1], theme, definition, scales);
    return `color-mix(in oklab, ${a}, ${b} ${percent(value.amount)})`;
  }
  if ("alpha" in value) {
    const color = cssValue(value.of, theme, definition, scales);
    return `color-mix(in oklab, ${color} ${percent(value.alpha)}, transparent)`;
  }
  return `var(--${autoForeground(value.auto, theme, definition, scales, [])})`;
}

function percent(fraction: number): string {
  return `${Math.round(fraction * 1000) / 10}%`;
}

function shadowValue(
  layers: readonly ShadowLayer[],
  theme: Theme,
  definition: ThemeDefinition,
  scales: Scales,
): string {
  return layers
    .map((layer) => `${layer.geometry} ${cssValue(layer.color, theme, definition, scales)}`)
    .join(", ");
}

/** Alle variabler i et tema som [navn, værdi], i en fast rækkefølge. */
function themeVariables(theme: Theme, definition: ThemeDefinition, scales: Scales) {
  const primitives: [string, string][] = [];
  if (theme === "light") {
    for (const [name, value] of Object.entries(constants)) primitives.push([name, value]);
  }
  for (const hue of Object.keys(palette) as Hue[]) {
    for (const step of STEPS) primitives.push([`${hue}-${step}`, scales[theme][hue][step]]);
  }
  const roles: [string, string][] = Object.entries(allTokens(definition)).map(([name, value]) => [
    name,
    cssValue(valueFor(value, theme), theme, definition, scales),
  ]);
  const shadows: [string, string][] = Object.entries(definition.shadows).map(([name, layers]) => [
    `elevation-${name}`,
    shadowValue(layers, theme, definition, scales),
  ]);
  return { primitives, roles, shadows };
}

// ---------------------------------------------------------------------------
// Typografi

export type Typography = {
  textStyles: Record<string, TextStyle>;
  capsTracking: Record<string, number>;
};

const em = (value: number) => `${value}em`;

/** `--text-<rolle>` med linjehøjde og tracking: Tailwinds `text-<rolle>`. */
function textStyleVariables(styles: Typography["textStyles"]): string {
  return Object.entries(styles)
    .flatMap(([name, style]) => [
      `  --text-${name}: ${style.size};`,
      `  --text-${name}--line-height: ${style.leading};`,
      `  --text-${name}--letter-spacing: ${em(style.tracking)};`,
    ])
    .join("\n");
}

/** `caps` / `caps-wide`: versaler med deres tracking (vinder over text-<rolle>'s). */
function capsUtilities(tracking: Typography["capsTracking"]): string {
  return Object.entries(tracking)
    .map(
      ([name, value]) => `@utility ${name} {
  text-transform: uppercase;
  --tw-tracking: ${em(value)};
  letter-spacing: ${em(value)};
}`,
    )
    .join("\n\n");
}

const HEADER = `/*
 * GENERERET af \`npm run tokens\` (scripts/build-tokens.ts) ud fra
 * src/styles/tokens/palette.ts (lag 1), themes.ts (lag 2–3) og
 * typography.ts (typeskalaen). Redigér ikke her: ret kilden og kør
 * \`npm run tokens\`. SPEC §13.2, §13.3.
 */`;

/** Høj kontrast: de ændrede roller pr. tema, i en media query til sidst i tokens.css. */
function highContrastCss(definition: ThemeDefinition, scales: Scales): string {
  const names = Object.keys(definition.highContrast ?? {});
  if (names.length === 0) return "";
  const contrast = withHighContrast(definition);
  const tokens = allTokens(contrast);
  const values = (theme: Theme) =>
    names.map((name): [string, string] => [
      name,
      cssValue(valueFor(tokens[name]!, theme), theme, contrast, scales),
    ]);
  const light = values("light");
  const lightByName = new Map(light);
  const dark = values("dark").filter(([name, value]) => lightByName.get(name) !== value);
  const block = (selector: string, entries: [string, string][]) =>
    `  ${selector} {\n${entries.map(([name, value]) => `    --${name}: ${value};`).join("\n")}\n  }`;
  return `
/*
 * Høj kontrast (prefers-contrast: more): de roller, der står i
 * \`highContrast\` i themes.ts. Står sidst, så de vinder over begge temaer.
 */
@media (prefers-contrast: more) {
${block(":root", light)}${dark.length > 0 ? `\n\n${block('[data-theme="dark"]', dark)}` : ""}
}
`;
}

/** tokens.css (uformateret; build-tokens.ts kører den gennem Prettier). */
export function buildCss(
  definition: ThemeDefinition,
  scales: Scales = generateScales(),
  typography: Typography = {
    textStyles: { ...textStyles, ...componentTextStyles },
    capsTracking,
  },
): string {
  const light = themeVariables("light", definition, scales);
  const dark = themeVariables("dark", definition, scales);
  const lightRoles = new Map(light.roles);
  const lightShadows = new Map(light.shadows);
  const declarations = (entries: [string, string][]) =>
    entries.map(([name, value]) => `  --${name}: ${value};`).join("\n");

  const utilities = [
    ...Object.keys(definition.colors).map((name) => `  --color-${name}: var(--${name});`),
    ...Object.keys(definition.shadows).map(
      (name) => `  --shadow-${name}: var(--elevation-${name});`,
    ),
  ].join("\n");

  return `${HEADER}

/*
 * Utilities: bg-*, text-*, border-* … for hver rolle i \`colors\`, shadow-* for hver
 * elevation og text-* for hver tekst-rolle. Tailwinds standardpalet og
 * -skriftstørrelser nulstilles først, så KUN rollerne findes (ingen tilfældige
 * farver, fx lilla, eller størrelser kan snige sig ind).
 */
@theme inline {
  --color-*: initial;
  --text-*: initial;
${utilities}

  /* Typeskalaen: størrelse, linjehøjde og tracking pr. rolle */
${textStyleVariables(typography.textStyles)}
}

/* Versaler: tracking til store bogstaver, uanset størrelse */
${capsUtilities(typography.capsTracking)}

:root {
  color-scheme: light;

  /* Lag 1 · primitiver */
${declarations(light.primitives)}

  /* Lag 2–3 · roller og komponent-tokens */
${declarations(light.roles)}

  /* Elevation */
${declarations(light.shadows)}
}

[data-theme="dark"] {
  color-scheme: dark;

  /* Lag 1 · primitiver */
${declarations(dark.primitives)}

  /* Roller, der peger på et andet trin i mørkt tema */
${declarations([
  ...dark.roles.filter(([name, value]) => lightRoles.get(name) !== value),
  ...dark.shadows.filter(([name, value]) => lightShadows.get(name) !== value),
])}
}
${highContrastCss(definition, scales)}`;
}

/** browser-colors.ts: browserens statusbar/adresselinje pr. tema (viewport.themeColor). */
export function buildBrowserColors(
  definition: ThemeDefinition,
  scales: Scales = generateScales(),
): string {
  return `// GENERERET af \`npm run tokens\` ud fra rollen \`frame\` (src/styles/tokens/themes.ts). Redigér ikke her.

/** App-rammens farve pr. tema: viewport.themeColor og temavælgeren på Profil. */
export const BROWSER_THEME_COLOR = {
  light: "${resolvedHex("frame", "light", definition, scales)}",
  dark: "${resolvedHex("frame", "dark", definition, scales)}",
} as const;
`;
}
