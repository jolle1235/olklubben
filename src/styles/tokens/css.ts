import { formatHex } from "culori";

import { constants, palette, STEPS, type Hue } from "./palette";
import {
  createResolver,
  tokensOf,
  valueFor,
  withHighContrast,
  type Resolver,
  type ThemeDefinition,
} from "./resolve";
import type { Scales, Theme } from "./scales";
import type { TextStyle } from "./typography";

/**
 * Skriver de genererede filer (SPEC §13.2, §13.3): tokens.css ud fra
 * skalaerne, rollerne og typeskalaen, og browser-colors.ts. render.ts samler
 * kilderne; `npm run tokens` skriver filerne.
 */

export type Typography = {
  /** Hver `text-*`-utility (roller og deres -tight/-loose-varianter). */
  textStyles: Record<string, Omit<TextStyle, "tight" | "loose">>;
  capsTracking: Record<string, number>;
};

export type TokenSources = {
  definition: ThemeDefinition;
  scales: Scales;
  typography: Typography;
};

type Declaration = [name: string, value: string];

const HEADER = `/*
 * GENERERET af \`npm run tokens\` (scripts/build-tokens.ts) ud fra
 * src/styles/tokens/palette.ts (lag 1), themes.ts (lag 2–3) og
 * typography.ts (typeskalaen). Redigér ikke her: ret kilden og kør
 * \`npm run tokens\`. SPEC §13.2, §13.3.
 */`;

/**
 * Mørkt tema slår til på to måder (SPEC §13.2): valgt på Profil
 * (data-theme="dark"), eller System (ingen data-theme) på en enhed i mørk
 * tilstand. Begge selektorer har samme specificitet som :root, så
 * rækkefølgen i filen afgør, og høj kontrast til sidst vinder.
 */
const DARK_CHOSEN = '[data-theme="dark"]';
const DARK_SYSTEM = ':root:where(:not([data-theme="light"]))';
const DARK_SYSTEM_QUERY = "(prefers-color-scheme: dark)";
const HIGH_CONTRAST_QUERY = "(prefers-contrast: more)";

const em = (value: number) => `${value}em`;

function declarations(entries: readonly Declaration[]): string {
  return entries.map(([name, value]) => `  --${name}: ${value};`).join("\n");
}

/** De erklæringer i `dark`, der har en anden værdi end i `light`. */
function changed(dark: readonly Declaration[], light: readonly Declaration[]): Declaration[] {
  const lightByName = new Map(light);
  return dark.filter(([name, value]) => lightByName.get(name) !== value);
}

function rule(selector: string, body: string, indent = ""): string {
  const inner = body
    .split("\n")
    .map((line) => (line ? `${indent}${line}` : line))
    .join("\n");
  return `${indent}${selector} {\n${inner}\n${indent}}`;
}

/** Samme erklæringer for begge veje til mørkt tema; `media` er en evt. ydre betingelse. */
function darkRules(body: string, media?: string): string {
  const system = media ? `${media} and ${DARK_SYSTEM_QUERY}` : DARK_SYSTEM_QUERY;
  const chosen = rule(DARK_CHOSEN, body, media ? "  " : "");
  return `${media ? `@media ${media} {\n${chosen}\n}` : chosen}

@media ${system} {
${rule(DARK_SYSTEM, body, "  ")}
}`;
}

/** Skalaernes trin (og i lyst tema de faste farver) som variabler. */
function primitives(scales: Scales, theme: Theme): Declaration[] {
  const fixed: Declaration[] = theme === "light" ? Object.entries(constants) : [];
  return [
    ...fixed,
    ...(Object.keys(palette) as Hue[]).flatMap((hue) =>
      STEPS.map((step): Declaration => [`${hue}-${step}`, scales[theme][hue][step]]),
    ),
  ];
}

/** Rollerne (colors + vars) i et tema, evt. kun de nævnte. */
function roles(
  definition: ThemeDefinition,
  resolver: Resolver,
  theme: Theme,
  names: readonly string[] = Object.keys(tokensOf(definition)),
): Declaration[] {
  const tokens = tokensOf(definition);
  return names.map((name) => [name, resolver.css(valueFor(tokens[name]!, theme), theme)]);
}

function shadows(definition: ThemeDefinition, resolver: Resolver, theme: Theme): Declaration[] {
  return Object.entries(definition.shadows).map(([name, layers]) => [
    `elevation-${name}`,
    layers.map((layer) => `${layer.geometry} ${resolver.css(layer.color, theme)}`).join(", "),
  ]);
}

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

/** Høj kontrast: de ændrede roller pr. tema, i en media query til sidst i tokens.css. */
function highContrastCss(definition: ThemeDefinition, scales: Scales): string {
  const names = Object.keys(definition.highContrast ?? {});
  if (names.length === 0) return "";
  const contrast = withHighContrast(definition);
  const resolver = createResolver(contrast, scales);
  const light = roles(contrast, resolver, "light", names);
  const dark = changed(roles(contrast, resolver, "dark", names), light);
  return `
/*
 * Høj kontrast (prefers-contrast: more): de roller, der står i
 * \`highContrast\` i themes.ts. Står sidst, så de vinder over begge temaer.
 */
@media ${HIGH_CONTRAST_QUERY} {
${rule(":root", declarations(light), "  ")}
}
${dark.length > 0 ? `\n${darkRules(declarations(dark), HIGH_CONTRAST_QUERY)}\n` : ""}`;
}

/** tokens.css, som den skrives (filen står i .prettierignore). */
export function buildCss({ definition, scales, typography }: TokenSources): string {
  const resolver = createResolver(definition, scales);
  const lightRoles = roles(definition, resolver, "light");
  const lightShadows = shadows(definition, resolver, "light");

  const utilities = [
    ...Object.keys(definition.colors).map((name) => `  --color-${name}: var(--${name});`),
    ...Object.keys(definition.shadows).map(
      (name) => `  --shadow-${name}: var(--elevation-${name});`,
    ),
  ].join("\n");

  return `${HEADER}

/*
 * Utilities: bg-*, text-*, border-* … for hver rolle i \`colors\`, shadow-* for hver
 * elevation og text-* for hver tekst-rolle. Tailwinds standardpalet,
 * -skriftstørrelser og -skygger nulstilles først, så KUN rollerne findes (ingen
 * tilfældige farver, fx lilla, størrelser eller sorte skygger kan snige sig ind).
 */
@theme inline {
  --color-*: initial;
  --text-*: initial;
  --shadow-*: initial;
  --inset-shadow-*: initial;
  --drop-shadow-*: initial;
${utilities}

  /* Typeskalaen: størrelse, linjehøjde og tracking pr. rolle */
${textStyleVariables(typography.textStyles)}
}

/* Versaler: tracking til store bogstaver, uanset størrelse */
${capsUtilities(typography.capsTracking)}

:root {
  color-scheme: light;

  /* Lag 1 · primitiver */
${declarations(primitives(scales, "light"))}

  /* Lag 2–3 · roller og komponent-tokens */
${declarations(lightRoles)}

  /* Elevation */
${declarations(lightShadows)}
}

/* Mørkt tema: valgt på Profil, eller System på en enhed i mørk tilstand */
${darkRules(`  color-scheme: dark;

  /* Lag 1 · primitiver */
${declarations(primitives(scales, "dark"))}

  /* Roller, der peger på et andet trin i mørkt tema */
${declarations([
  ...changed(roles(definition, resolver, "dark"), lightRoles),
  ...changed(shadows(definition, resolver, "dark"), lightShadows),
])}`)}
${highContrastCss(definition, scales)}`;
}

/** browser-colors.ts: browserens statusbar/adresselinje pr. tema (viewport.themeColor). */
export function buildBrowserColors({
  definition,
  scales,
}: Pick<TokenSources, "definition" | "scales">): string {
  const resolver = createResolver(definition, scales);
  const hex = (theme: Theme) => formatHex(resolver.color({ token: "frame" }, theme));
  return `// GENERERET af \`npm run tokens\` ud fra rollen \`frame\` (src/styles/tokens/themes.ts). Redigér ikke her.

/** App-rammens farve pr. tema: viewport.themeColor og temavælgeren på Profil. */
export const BROWSER_THEME_COLOR = {
  light: "${hex("light")}",
  dark: "${hex("dark")}",
} as const;
`;
}
