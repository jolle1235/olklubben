import { formatHex } from "culori";

import { constants, palette, STEPS, type Hue } from "./palette";
import { createResolver, withHighContrast, type Resolver, type ThemeDefinition } from "./resolve";
import type { Scales, Theme } from "./scales";
import { DARK_SCHEME_QUERY, THEME_ATTRIBUTE } from "./theme-attribute";
import type { capsTracking, textUtilities } from "./typography";

type Typography = {
  textStyles: ReturnType<typeof textUtilities>;
  capsTracking: typeof capsTracking;
};

type Declaration = [name: string, value: string];

const HEADER = `/*
 * GENERERET af \`npm run tokens\` ud fra src/styles/tokens/palette.ts, themes.ts
 * og typography.ts. Redigér ikke her (SPEC §13.2, §13.3).
 */`;

/**
 * Valgt mørkt tema, eller System på en mørk enhed. Begge har samme specificitet
 * som :root, så rækkefølgen i filen afgør, og høj kontrast sidst vinder.
 */
const DARK_CHOSEN = `[${THEME_ATTRIBUTE}="dark"]`;
const DARK_SYSTEM = `:root:where(:not([${THEME_ATTRIBUTE}="light"]))`;
const HIGH_CONTRAST_QUERY = "(prefers-contrast: more)";

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

function textStyleVariables(styles: Typography["textStyles"]): Declaration[] {
  return Object.entries(styles).flatMap(([name, style]): Declaration[] => [
    [`text-${name}`, style.size],
    [`text-${name}--line-height`, `${style.leading}`],
    [`text-${name}--letter-spacing`, em(style.tracking)],
  ]);
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
