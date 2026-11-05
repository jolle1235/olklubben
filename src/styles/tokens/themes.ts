import type { ColorValue, Ref, ShadowLayer, ThemeDefinition, ThemedValue } from "./resolve";
import type { Hue, Step } from "./palette";

/**
 * Lag 2 · roller og lag 3 · komponent-tokens (SPEC §13.2). Et trin skifter selv
 * med temaet; `{ light, dark }` står kun, hvor en rolle bruger et andet trin.
 */

const roles = {
  neutral: "sand",
  /** App-rammen: top bar, sidebar, bundnavigation. */
  frame: "olive",
  /** Fremhævede kort, fx Overblikkets hero. */
  feature: "harbor",
  primary: "olive",
  highlight: "amber",
  info: "harbor",
  success: "olive",
  destructive: "red",
} as const satisfies Record<string, Hue>;

const FAMILIES = ["primary", "highlight", "info", "success", "destructive"] as const;
type Family = (typeof FAMILIES)[number];

const at = (hue: Hue, step: Step): Ref => `${hue}.${step}`;
const neutral = (step: Step): Ref => at(roles.neutral, step);
const token = (name: string): ColorValue => ({ token: name });

/** Ligger mellem fladen under og tonen, som begge er kontrasttestet, så teksten holder. */
const faint = (tone: string): ColorValue => ({ alpha: 0.6, of: token(tone) });

/** Hvad hvert token i en familie bruges til: SPEC §13.2 "Farvefamilier". */
function family(name: Family): Record<string, ThemedValue> {
  const hue = roles[name];
  return {
    [name]: at(hue, 9),
    [`${name}-hover`]: at(hue, 10),
    [`${name}-foreground`]: { auto: at(hue, 9) },
    [`${name}-subtle`]: at(hue, 3),
    [`${name}-subtle-hover`]: at(hue, 4),
    [`${name}-faint`]: faint(`${name}-subtle`),
    [`${name}-border`]: at(hue, 7),
    [`${name}-ink`]: at(hue, 11),
  };
}

/** En mørk flade med egen tekst. Blandinger frem for trin, så tonerne følger fladen. */
function surface(name: string, base: ThemedValue): Record<string, ThemedValue> {
  const foreground = token(`${name}-foreground`);
  return {
    [name]: base,
    [`${name}-hover`]: { mix: [token(name), foreground], amount: 0.08 },
    [`${name}-faint`]: faint(`${name}-hover`),
    [`${name}-sunken`]: { mix: [token(name), "black"], amount: 0.3 },
    [`${name}-foreground`]: { auto: token(name) },
    [`${name}-muted-foreground`]: { mix: [foreground, token(name)], amount: 0.18 },
    [`${name}-border`]: { alpha: 0.1, of: foreground },
    [`${name}-border-strong`]: {
      mix: [token(name), token(`${name}-muted-foreground`)],
      amount: 0.45,
    },
    [`${name}-ring`]: at(roles.highlight, 9),
  };
}

/**
 * På de mørke flader er dæmpet tekst lig med teksten: der er ikke plads til et
 * mellemtrin over 7:1.
 */
function highContrast(): Record<string, ThemedValue> {
  return {
    "muted-foreground": { mix: [neutral(11), neutral(12)], amount: 0.5 },
    border: token("border-strong"),
    scrim: { light: { alpha: 0.7, of: "fixed-dark" }, dark: { alpha: 0.8, of: "black" } },
    ...Object.fromEntries(
      (["frame", "feature"] as const).flatMap((name) => [
        [`${name}-muted-foreground`, token(`${name}-foreground`)],
        [`${name}-border`, { alpha: 0.4, of: token(`${name}-foreground`) }],
      ]),
    ),
    ...Object.fromEntries(FAMILIES.map((name) => [`${name}-border`, at(roles[name], 8)])),
  };
}

const shadow = (geometry: string, alpha: number): ShadowLayer => ({
  geometry,
  color: { alpha, of: token("shadow-color") },
});

export const themeDefinition: ThemeDefinition = {
  colors: {
    background: { light: neutral(2), dark: neutral(1) },
    foreground: neutral(12),
    card: { light: neutral(1), dark: neutral(2) },
    "card-hover": { mix: [token("card"), token("muted")], amount: 0.6 },
    "card-faint": faint("card"),
    "card-foreground": neutral(12),
    popover: { light: neutral(1), dark: neutral(3) },
    "popover-foreground": neutral(12),
    muted: neutral(3),
    /** Kun brødtekst holder AA her: dæmpet tekst skifter til foreground. */
    "muted-hover": neutral(4),
    "muted-faint": faint("muted"),
    "muted-foreground": neutral(11),
    border: neutral(6),
    /** Kanter, der skal ses (≥ 3:1). */
    "border-strong": neutral(8),
    input: token("border-strong"),
    ring: { light: at(roles.highlight, 11), dark: at(roles.highlight, 9) },
    /** Overlay bag dialoger. */
    scrim: { light: { alpha: 0.5, of: "fixed-dark" }, dark: { alpha: 0.65, of: "black" } },

    ...surface("frame", { light: at(roles.frame, 9), dark: at(roles.frame, 3) }),
    ...surface("feature", { light: at(roles.feature, 9), dark: at(roles.feature, 4) }),
    "feature-highlight": at(roles.highlight, 10),

    ...family("primary"),
    ...family("highlight"),
    ...family("info"),
    ...family("success"),
    ...family("destructive"),

    // shadcn-aliaser
    secondary: neutral(4),
    "secondary-hover": { mix: [token("secondary"), token("primary")], amount: 0.08 },
    "secondary-foreground": token("primary-ink"),
    accent: token("highlight-subtle"),
    "accent-foreground": neutral(12),
    sidebar: token("frame"),
    "sidebar-foreground": token("frame-foreground"),
    "sidebar-primary": token("highlight"),
    "sidebar-primary-foreground": token("highlight-foreground"),
    "sidebar-accent": token("frame-hover"),
    "sidebar-accent-foreground": token("frame-foreground"),
    "sidebar-border": token("frame-border"),
    "sidebar-ring": token("frame-ring"),

    // Lag 3 · komponent-tokens
    "avatar-1": { light: at("olive", 9), dark: at("olive", 7) },
    "avatar-2": at("harbor", 9),
    "avatar-3": at("rust", 9),
    "avatar-4": at("brown", 9),
    "avatar-5": { light: neutral(11), dark: neutral(8) },
    "avatar-foreground": "fixed-light",
    "chart-1": at(roles.primary, 9),
    "chart-2": at(roles.highlight, 9),
    "chart-3": at(roles.info, 9),
    "chart-4": at("rust", 9),
    "chart-5": at("brown", 9),
    skeleton: { alpha: 0.7, of: token("secondary") },
    "invalid-ring": { alpha: 0.25, of: token("destructive") },
  },

  vars: {
    "porthole-ring": at(roles.highlight, 9),
    /** Spalten mellem porthole-ringen og indholdet (SPEC §13.1). */
    "porthole-gap": token("card"),
    "porthole-shadow": { alpha: 0.2, of: token("shadow-color") },
    "shadow-color": { light: at(roles.frame, 10), dark: "black" },
  },

  shadows: {
    raised: [shadow("0 10px 24px -20px", 0.7)],
    floating: [shadow("0 18px 40px -16px", 0.5)],
    overlay: [shadow("0 30px 60px -24px", 0.6)],
    hero: [shadow("0 22px 44px -26px", 0.95)],
    /** Bundnavigationen. */
    bar: [shadow("0 -12px 30px -18px", 0.7)],
    /** Solide knappers kant forneden. */
    press: [{ geometry: "inset 0 -2px 0", color: { alpha: 0.2, of: "black" } }],
  },

  highContrast: highContrast(),
};
