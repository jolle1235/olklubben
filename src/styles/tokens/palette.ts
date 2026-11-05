/** Lag 1 · primitiver (SPEC §13.2): det eneste sted med farveværdier. */

export const STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export type Step = (typeof STEPS)[number];

export type ScaleInput = {
  /** Trin 9 i lyst tema. Resten af skalaen får kulør og mætning herfra. */
  base: string;
  /** Trin 9 i mørkt tema. Standard: `base`. */
  darkBase?: string;
  /** Låste trin pr. tema (her D-092's farver). De følger ikke med en ny base. */
  light?: Partial<Record<Step, string>>;
  dark?: Partial<Record<Step, string>>;
};

export const palette = {
  olive: {
    base: "#414437",
    // Lysere i mørkt tema, så en solid knap står frem på den mørke baggrund.
    darkBase: "#a4a985",
    light: { 3: "#e3e8ce", 10: "#2d2f23", 11: "#414437" },
  },
  harbor: {
    base: "#3e5568",
    darkBase: "#4e6679",
    light: { 3: "#dce6ee" },
  },
  amber: {
    base: "#d99a1e",
    light: { 3: "#f6e3b4", 10: "#f2c46a", 11: "#8a5a00" },
    dark: { 10: "#f2c46a" },
  },
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
  red: {
    base: "#b3261e",
    light: { 3: "#f6deda", 10: "#8f1d17" },
  },
  /** Uden rolle: kun avatarer og diagrammer. */
  rust: { base: "#8a3b2e" },
  brown: { base: "#7a4a12" },
} satisfies Record<string, ScaleInput>;

export type Hue = keyof typeof palette;

/** Farver, der ikke skifter med temaet. */
export const constants = {
  white: "#ffffff",
  black: "#000000",
  "fixed-light": "#fffbf3",
  "fixed-dark": "#1a1d21",
} as const;

export type Constant = keyof typeof constants;
