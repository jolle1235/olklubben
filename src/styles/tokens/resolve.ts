import { blend, converter, interpolate, wcagContrast, type Color } from "culori";

import { constants, palette, STEPS, type Constant, type Hue, type Step } from "./palette";
import { THEMES, type Scales, type Theme } from "./scales";

export type Ref = `${Hue}.${Step}` | Constant;

/**
 * `mix`: `amount` af b blandet i a (OKLab). `auto`: den faste lyse eller mørke
 * tekstfarve med mest kontrast mod fladen.
 */
export type ColorValue =
  | Ref
  | { token: string }
  | { mix: readonly [ColorValue, ColorValue]; amount: number }
  | { alpha: number; of: ColorValue }
  | { auto: ColorValue };

export type ThemedValue = ColorValue | { light: ColorValue; dark: ColorValue };

/** `geometry` er box-shadow uden farven, fx "0 10px 24px -20px". */
export type ShadowLayer = { geometry: string; color: ColorValue };

export type ThemeDefinition = {
  /** Bliver også Tailwind-utilities (bg-*, text-* …). */
  colors: Record<string, ThemedValue>;
  /** Kun CSS-variabler, ingen utilities. */
  vars: Record<string, ThemedValue>;
  /** Bliver `--elevation-<navn>` og `shadow-<navn>`. */
  shadows: Record<string, readonly ShadowLayer[]>;
  /** Roller med en anden værdi ved `prefers-contrast: more`, i begge temaer. */
  highContrast?: Record<string, ThemedValue>;
};

export type Resolver = {
  color(value: ColorValue, theme: Theme): Color;
  /** Kun `auto` er regnet ud på forhånd; resten bliver var() og color-mix(). */
  css(value: ColorValue, theme: Theme): string;
  roleCss(name: string, theme: Theme): string;
  /** En gennemsigtig forgrund lægges først på baggrunden. */
  contrast(foreground: ColorValue, background: ColorValue, theme: Theme): number;
};

const toRgb = converter("rgb");

function valueFor(value: ThemedValue, theme: Theme): ColorValue {
  return typeof value === "object" && "light" in value && "dark" in value ? value[theme] : value;
}

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
 * Tjekker alle roller og skygger i begge temaer med det samme, så en ukendt rolle
 * eller en cyklus fejler her og aldrig bliver til cykliske var() i tokens.css.
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
      const shown = (fg.alpha ?? 1) >= 1 ? fg : toRgb(blend([bg, fg], "normal"));
      return wcagContrast(shown, bg);
    },
  };
}

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
