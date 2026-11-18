import { formatHex } from "culori";

import { constants, palette, STEPS, type Hue } from "./palette";
import { createResolver, withHighContrast, type Resolver, type ThemeDefinition } from "./resolve";
import type { Scales, Theme } from "./scales";
import { DARK_SCHEME_QUERY, THEME_ATTRIBUTE } from "./theme-attribute";
import type { spacing } from "./spacing";
import type { capsTracking, semanticTextUtilities, textUtilities } from "./typography";

type Typography = {
  textStyles: ReturnType<typeof textUtilities>;
  semanticTextStyles: ReturnType<typeof semanticTextUtilities>;
  capsTracking: typeof capsTracking;
};

type Spacing = typeof spacing;

type Declaration = [name: string, value: string];

const HEADER = `/*
 * GENERERET af \`npm run tokens\` ud fra src/styles/tokens/palette.ts, themes.ts,
 * typography.ts og spacing.ts. Redigér ikke her (SPEC §13.2, §13.3).
 */`;

/**
 * Valgt mørkt tema, eller System på en mørk enhed. Begge har samme specificitet
 * som :root, så rækkefølgen i filen afgør, og høj kontrast sidst vinder.
 */
const DARK_CHOSEN = `[${THEME_ATTRIBUTE}="dark"]`;
const DARK_SYSTEM = `:root:where(:not([${THEME_ATTRIBUTE}="light"]))`;
const HIGH_CONTRAST_QUERY = "(prefers-contrast: more)";
/** Tailwinds `md`. Semantiske roller og afstande skifter værdi her. */
const MD_QUERY = "(width >= 48rem)";

const em = (value: number) => `${value}em`;

function declarations(entries: readonly Declaration[]): string {
  return entries.map(([name, value]) => `  --${name}: ${value};`).join("\n");
}

/** Lyst tema i sin helhed, mørkt kun med det, der skifter værdi. */
function perTheme(build: (theme: Theme) => Declaration[]): Record<Theme, Declaration[]> {
  const light = build("light");
  const lightByName = new Map(light);
  return { light, dark: build("dark").filter(([name, value]) => lightByName.get(name) !== value) };
}

function indent(text: string): string {
  return text
    .split("\n")
    .map((line) => (line ? `  ${line}` : line))
    .join("\n");
}

function rule(selector: string, body: string): string {
  return `${selector} {\n${body}\n}`;
}

function darkRules(body: string): string {
  return `${rule(DARK_CHOSEN, body)}

@media ${DARK_SCHEME_QUERY} {
${indent(rule(DARK_SYSTEM, body))}
}`;
}

/** De faste farver skrives kun i :root: de skifter ikke med temaet. */
function primitives(scales: Scales, theme: Theme): Declaration[] {
  const fixed: Declaration[] = theme === "light" ? Object.entries(constants) : [];
  return [
    ...fixed,
    ...(Object.keys(palette) as Hue[]).flatMap((hue) =>
      STEPS.map((step): Declaration => [`${hue}-${step}`, scales[theme][hue][step]]),
    ),
  ];
}

function roles(resolver: Resolver, theme: Theme, names: readonly string[]): Declaration[] {
  return names.map((name) => [name, resolver.roleCss(name, theme)]);
}

function shadows(definition: ThemeDefinition, resolver: Resolver, theme: Theme): Declaration[] {
  return Object.entries(definition.shadows).map(([name, layers]) => [
    `elevation-${name}`,
    layers.map((layer) => `${layer.geometry} ${resolver.css(layer.color, theme)}`).join(", "),
  ]);
}

type TextValues = { size: string; leading: string; tracking: string };

/** `--<prefix>-<navn>` med størrelse, linjehøjde og tracking: det Tailwind læser for `text-*`. */
function textVariables(prefix: string, name: string, values: TextValues): Declaration[] {
  return [
    [`${prefix}-${name}`, values.size],
    [`${prefix}-${name}--line-height`, values.leading],
    [`${prefix}-${name}--letter-spacing`, values.tracking],
  ];
}

const textValues = (style: Typography["textStyles"][string]): TextValues => ({
  size: style.size,
  leading: `${style.leading}`,
  tracking: em(style.tracking),
});

function textStyleVariables(styles: Typography["textStyles"]): Declaration[] {
  return Object.entries(styles).flatMap(([name, style]) =>
    textVariables("text", name, textValues(style)),
  );
}

/**
 * Semantiske roller og afstande er variabler, der skifter ved md. `@theme inline`
 * peger på dem, så Tailwind laver almindelige utilities (`md:`, `leading-none` og
 * `caps` virker som på de faste roller).
 */
function responsiveThemeVariables(typography: Typography, space: Spacing): Declaration[] {
  return [
    ...Object.keys(typography.semanticTextStyles).flatMap((name) =>
      textVariables("text", name, {
        size: `var(--type-${name})`,
        leading: `var(--type-${name}--line-height)`,
        tracking: `var(--type-${name}--letter-spacing)`,
      }),
    ),
    ...Object.keys(space).map((name): Declaration => [`spacing-${name}`, `var(--space-${name})`]),
  ];
}

function responsiveValues(
  typography: Typography,
  space: Spacing,
  breakpoint: "base" | "md",
): Declaration[] {
  return [
    ...Object.entries(typography.semanticTextStyles).flatMap(([name, styles]) =>
      textVariables("type", name, textValues(styles[breakpoint])),
    ),
    ...Object.entries(space).map(([name, value]): Declaration => [
      `space-${name}`,
      value[breakpoint],
    ]),
  ];
}

/** `--tw-tracking` gør, at versal-trackingen vinder over text-<rolle>'s. */
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

function highContrastCss(definition: ThemeDefinition, scales: Scales): string {
  const names = Object.keys(definition.highContrast ?? {});
  if (names.length === 0) return "";
  const resolver = createResolver(withHighContrast(definition), scales);
  const { light, dark } = perTheme((theme) => roles(resolver, theme, names));
  const body = dark.length > 0 ? `\n\n${darkRules(declarations(dark))}` : "";
  return `
/* Høj kontrast: står sidst, så den vinder over begge temaer */
@media ${HIGH_CONTRAST_QUERY} {
${indent(rule(":root", declarations(light)) + body)}
}
`;
}

export function buildCss(
  definition: ThemeDefinition,
  scales: Scales,
  typography: Typography,
  space: Spacing,
): string {
  const resolver = createResolver(definition, scales);
  const roleNames = [...Object.keys(definition.colors), ...Object.keys(definition.vars)];
  const roleValues = perTheme((theme) => roles(resolver, theme, roleNames));
  const shadowValues = perTheme((theme) => shadows(definition, resolver, theme));

  const utilities = [
    ...Object.keys(definition.colors).map((name): Declaration => [
      `color-${name}`,
      `var(--${name})`,
    ]),
    ...Object.keys(definition.shadows).map((name): Declaration => [
      `shadow-${name}`,
      `var(--elevation-${name})`,
    ]),
  ];

  return `${HEADER}

/*
 * Kun rollerne findes: Tailwinds farver, størrelser og skygger nulstilles her,
 * i samme blok og før rollerne (F-089).
 */
@theme inline {
  --color-*: initial;
  --text-*: initial;
  --shadow-*: initial;
  --inset-shadow-*: initial;
  --drop-shadow-*: initial;
${declarations(utilities)}

  /* Typeskalaen */
${declarations(textStyleVariables(typography.textStyles))}

  /* Semantiske roller og afstande (skifter ved md) */
${declarations(responsiveThemeVariables(typography, space))}
}

${capsUtilities(typography.capsTracking)}

:root {
  color-scheme: light;

  /* Lag 1 · primitiver */
${declarations(primitives(scales, "light"))}

  /* Lag 2–3 · roller og komponent-tokens */
${declarations(roleValues.light)}

  /* Elevation */
${declarations(shadowValues.light)}

  /* Semantiske roller og afstande på mobil */
${declarations(responsiveValues(typography, space, "base"))}
}

@media ${MD_QUERY} {
${indent(rule(":root", declarations(responsiveValues(typography, space, "md"))))}
}

/* Mørkt tema */
${darkRules(`  color-scheme: dark;

  /* Lag 1 · primitiver */
${declarations(primitives(scales, "dark"))}

  /* Kun roller og skygger, der skifter værdi */
${declarations([...roleValues.dark, ...shadowValues.dark])}`)}
${highContrastCss(definition, scales)}`;
}

export function buildBrowserColors(definition: ThemeDefinition, scales: Scales): string {
  const resolver = createResolver(definition, scales);
  const hex = (theme: Theme) => formatHex(resolver.color({ token: "frame" }, theme));
  return `// GENERERET af \`npm run tokens\` ud fra rollen \`frame\` (src/styles/tokens/themes.ts). Redigér ikke her.

export const BROWSER_THEME_COLOR = {
  light: "${hex("light")}",
  dark: "${hex("dark")}",
} as const;
`;
}
