/**
 * LAG 1 · Primitiver (SPEC §13.2 "Farvesystem"). Det ENESTE sted i appen med
 * farveværdier. Komponenter bruger aldrig disse direkte: de bruger rollerne i
 * themes.ts (lag 2), som `npm run tokens` gør til CSS-variabler og
 * Tailwind-utilities i tokens.css.
 *
 * Hver skala har 12 trin i en lys og en mørk udgave (Radix Colors' konvention):
 *
 *    1–2   app-baggrund, subtil baggrund
 *    3–5   komponent-flade: normal, hover, aktiv/valgt
 *    6–8   subtil kant, kant, stærk kant/fokus
 *    9–10  solid farve, solid hover
 *   11–12  farvet tekst, tekst med høj kontrast
 *
 * En skala genereres ud fra ÉN basisfarve (trin 9) i OKLCH (scales.ts). `light`
 * og `dark` kan låse enkelte trin. Låsene her holder appen på D-092-farverne
 * (cream, paper, ink, slate …); de kan fjernes, når paletten skiftes.
 *
 * Sådan ændrer du en farve: ret `base` her, kør `npm run tokens`, og kør
 * `npm test`: kontrasttesten (contrast.test.ts) siger til, hvis et par falder
 * under WCAG AA i et af temaerne. Låste trin følger ikke med en ny base: fjern
 * dem, når hele skalaen skal skifte.
 */

export const STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export type Step = (typeof STEPS)[number];

export type ScaleInput = {
  /** Trin 9 i lyst tema. Skalaens kulør og mætning kommer herfra. */
  base: string;
  /** Trin 9 i mørkt tema. Standard: `base`. */
  darkBase?: string;
  /** Låste trin i lyst tema. */
  light?: Partial<Record<Step, string>>;
  /** Låste trin i mørkt tema. */
  dark?: Partial<Record<Step, string>>;
};

export const palette = {
  /** Oliven (Jespers farve, D-092). */
  olive: {
    base: "#414437",
    // Lysere i mørkt tema, så en solid knap står frem på den mørke baggrund.
    darkBase: "#a4a985",
    light: { 3: "#e3e8ce", 10: "#2d2f23", 11: "#414437" },
  },
  /** Havneblå. */
  harbor: {
    base: "#3e5568",
    darkBase: "#4e6679",
    light: { 3: "#dce6ee" },
  },
  /** Messing/amber. */
  amber: {
    base: "#d99a1e",
    light: { 3: "#f6e3b4", 10: "#f2c46a", 11: "#8a5a00" },
    dark: { 10: "#f2c46a" },
  },
  /** Varm neutral: baggrund, kort, kanter og tekst. */
  sand: {
    base: "#9c8f74",
    light: {
      1: "#fffbf3",
      2: "#f6f0e1",
      3: "#ede5d2",
      4: "#e6dbc1",
      6: "#ddd0b3",
      8: "#8c7f66",
      11: "#5e6670",
      12: "#1a1d21",
    },
  },
  /** Fare/destruktiv. */
  red: {
    base: "#b3261e",
    light: { 3: "#f6deda", 10: "#8f1d17" },
  },
  /** Avatarfarver. */
  rust: { base: "#8a3b2e" },
  brown: { base: "#7a4a12" },
} satisfies Record<string, ScaleInput>;

export type Hue = keyof typeof palette;

/**
 * Faste farver, der ikke skifter med temaet: tekst på solide flader (valgt
 * automatisk efter kontrast, se `auto` i themes.ts) og hvid/sort til skygger
 * og overlays.
 */
export const constants = {
  white: "#ffffff",
  black: "#000000",
  /** Lys tekst på mørke, solide flader. */
  "fixed-light": "#fffbf3",
  /** Mørk tekst på lyse, solide flader. */
  "fixed-dark": "#1a1d21",
} as const;

export type Constant = keyof typeof constants;
