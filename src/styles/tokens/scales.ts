import { converter, formatHex, toGamut, type Color } from "culori";

import { palette, STEPS, type Hue, type ScaleInput, type Step } from "./palette";

/** Kun til `npm run tokens` og testene, aldrig i appen: culori er en devDependency. */

export type Theme = "light" | "dark";
export const THEMES: readonly Theme[] = ["light", "dark"];

export type Scales = Record<Theme, Record<Hue, Record<Step, string>>>;

const toOklch = converter("oklch");
const intoGamut = toGamut("rgb", "oklch");

/** OKLCH-lyshed og andel af basens chroma pr. trin. Manglende trin regnes ud fra basen. */
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

function generateScale(input: ScaleInput, theme: Theme): Record<Step, string> {
  const baseHex = theme === "dark" ? (input.darkBase ?? input.base) : input.base;
  const base = toOklch(baseHex);
  if (!base) throw new Error(`Ugyldig farve: ${baseHex}`);
  const curve = CURVES[theme];

  const lightnessOf = (step: Step): number => {
    if (step === 10) return theme === "light" ? base.l - 0.04 : base.l + 0.04;
    // Farvet tekst: højst L 0,5, så den holder 4,5:1 på trin 1–3.
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
            h: base.h ?? 0,
          }));
  }
  return scale;
}

export function generateScales(): Scales {
  const result = { light: {}, dark: {} } as Scales;
  for (const theme of THEMES) {
    for (const hue of Object.keys(palette) as Hue[]) {
      result[theme][hue] = generateScale(palette[hue], theme);
    }
  }
  return result;
}
