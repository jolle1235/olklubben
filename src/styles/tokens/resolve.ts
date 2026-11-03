import { blend, converter, interpolate, wcagContrast, type Color } from "culori";

import { constants, palette, STEPS, type Constant, type Hue, type Step } from "./palette";
import { THEMES, type Scales, type Theme } from "./scales";

/**
 * Lag 2–3 (SPEC §13.2): hvad værdierne i themes.ts betyder. createResolver
 * giver hver værdi som farve (kontrasttesten, browserens temafarve) og som
 * CSS (tokens.css) ud fra samme definition.
 */

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

export type Resolver = {
  /** Farven en værdi ender med i et tema (sRGB, evt. med alfa). */
  color(value: ColorValue, theme: Theme): Color;
  /** Værdien som CSS (var(--…), color-mix()); kun `auto` er regnet ud på forhånd. */
  css(value: ColorValue, theme: Theme): string;
  /** En rolles værdi i et tema som CSS. */
  roleCss(name: string, theme: Theme): string;
  /** WCAG-kontrasten mellem to værdier i et tema (forgrunden lægges på baggrunden). */
  contrast(foreground: ColorValue, background: ColorValue, theme: Theme): number;
};

const toRgb = converter("rgb");

function valueFor(value: ThemedValue, theme: Theme): ColorValue {
  return typeof value === "object" && "light" in value && "dark" in value ? value[theme] : value;
}

/** Alle roller (colors + vars) på navn. */
function tokensOf(definition: ThemeDefinition): Record<string, ThemedValue> {
  return { ...definition.colors, ...definition.vars };
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

function percent(fraction: number): string {
  return `${Math.round(fraction * 1000) / 10}%`;
}

/**
 * Opløser værdierne i en definition. Alle roller og skygger tjekkes i begge
 * temaer med det samme: en ukendt rolle, et ukendt trin eller en cirkulær
 * henvisning fejler her, også for roller, som kontrasttesten ikke nævner, så
 * tokens.css aldrig får en cyklus af var()'er.
 */
export function createResolver(definition: ThemeDefinition, scales: Scales): Resolver {
  const tokens = tokensOf(definition);

  function color(value: ColorValue, theme: Theme, seen: readonly string[] = []): Color {
    if (typeof value === "string") {
      if (isConstant(value)) return toRgb(constants[value])!;
      const [hue, step] = splitRef(value);
      return toRgb(scales[theme][hue][step])!;
    }
    if ("token" in value) {
      const target = tokens[value.token];
      if (!target) throw new Error(`Ukendt rolle "${value.token}"`);
      if (seen.includes(value.token)) {
        throw new Error(`Cirkulær rolle: ${[...seen, value.token].join(" → ")}`);
      }
      return color(valueFor(target, theme), theme, [...seen, value.token]);
    }
    if ("mix" in value) {
      const a = color(value.mix[0], theme, seen);
      const b = color(value.mix[1], theme, seen);
      return toRgb(interpolate([a, b], "oklab")(value.amount));
    }
    if ("alpha" in value) {
      const base = color(value.of, theme, seen);
      return { ...toRgb(base), alpha: (base.alpha ?? 1) * value.alpha };
    }
    return toRgb(constants[autoForeground(value.auto, theme, seen)])!;
  }

  /** Den faste tekstfarve (lys eller mørk), der giver mest kontrast mod fladen. */
  function autoForeground(surface: ColorValue, theme: Theme, seen: readonly string[]): Constant {
    const background = color(surface, theme, seen);
    return wcagContrast(constants["fixed-light"], background) >=
      wcagContrast(constants["fixed-dark"], background)
      ? "fixed-light"
      : "fixed-dark";
  }

  function css(value: ColorValue, theme: Theme): string {
    if (typeof value === "string") {
      return `var(--${isConstant(value) ? value : value.replace(".", "-")})`;
    }
    if ("token" in value) return `var(--${value.token})`;
    if ("mix" in value) {
      const [a, b] = value.mix;
      return `color-mix(in oklab, ${css(a, theme)}, ${css(b, theme)} ${percent(value.amount)})`;
    }
    if ("alpha" in value) {
      return `color-mix(in oklab, ${css(value.of, theme)} ${percent(value.alpha)}, transparent)`;
    }
    return `var(--${autoForeground(value.auto, theme, [])})`;
  }

  for (const theme of THEMES) {
    for (const name of Object.keys(tokens)) color({ token: name }, theme);
    for (const layer of Object.values(definition.shadows).flat()) color(layer.color, theme);
  }

  return {
    color: (value, theme) => color(value, theme),
    css,
    roleCss(name, theme) {
      const value = tokens[name];
      if (!value) throw new Error(`Ukendt rolle "${name}"`);
      return css(valueFor(value, theme), theme);
    },
    contrast(foreground, background, theme) {
      const bg = color(background, theme);
      const fg = color(foreground, theme);
      // En (evt. gennemsigtig) forgrund lagt oven på baggrunden.
      const shown = (fg.alpha ?? 1) >= 1 ? fg : toRgb(blend([bg, fg], "normal"));
      return wcagContrast(shown, bg);
    },
  };
}

/** Definitionen, som den ser ud ved høj kontrast (rollerne i `highContrast` lagt ovenpå). */
export function withHighContrast(definition: ThemeDefinition): ThemeDefinition {
  const overrides = definition.highContrast ?? {};
  const known = tokensOf(definition);
  for (const name of Object.keys(overrides)) {
    if (!(name in known)) throw new Error(`Ukendt rolle i highContrast: "${name}"`);
  }
  const pick = (group: Record<string, ThemedValue>) =>
    Object.fromEntries(
      Object.entries(group).map(([name, value]) => [name, overrides[name] ?? value]),
    );
  return {
    ...definition,
    colors: pick(definition.colors),
    vars: pick(definition.vars),
    highContrast: {},
  };
}
