import type { ColorValue, Ref, ShadowLayer, ThemeDefinition, ThemedValue } from "./build";
import type { Hue, Step } from "./palette";

/**
 * LAG 2 · Semantiske roller og LAG 3 · komponent-tokens (SPEC §13.2).
 * Komponenter bruger KUN disse, via Tailwind (bg-primary, text-muted-foreground,
 * shadow-raised …) eller som CSS-variabler (var(--frame)). Ingen `dark:` i
 * komponenter: temaet skifter, fordi skalaerne under rollerne skifter.
 *
 * Trin-mapningen er den samme i lyst og mørkt tema; kun skalaerne skifter.
 * Hvor en rolle skal pege på et andet trin i mørkt tema, står det som
 * `{ light, dark }`.
 */

/** Hvilken skala hver rolle bruger. Skift primærfarven = ret én linje. */
export const roles = {
  /** Baggrund, kort, kanter og tekst. */
  neutral: "sand",
  /** App-rammen: top bar, sidebar, bundnavigation, login-båndet, toasts. */
  frame: "olive",
  /** Fremhævede kort: Overblikkets hero, "Klubbens rating", afstemningens resultat. */
  feature: "harbor",
  /** Handlinger: primærknapper, links, aktive og valgte tilstande, bekræftede events. */
  primary: "olive",
  /** Accent: stjerner, "I aften!", messingknappen. */
  highlight: "amber",
  /** Info-badges og info-beskeder. */
  info: "harbor",
  /** Succes-beskeder. */
  success: "olive",
  /** Destruktive handlinger og fejl. */
  destructive: "red",
} as const satisfies Record<string, Hue>;

const at = (hue: Hue, step: Step): Ref => `${hue}.${step}`;
const neutral = (step: Step): Ref => at(roles.neutral, step);
const token = (name: string): ColorValue => ({ token: name });

/**
 * En farvefamilie. Alle handlings- og statusroller har præcis det samme sæt:
 *
 *   {rolle}             trin 9   solid flade (knap, badge)
 *   {rolle}-hover       trin 10  hover på den solide flade
 *   {rolle}-foreground  –        tekst/ikon på den solide flade (vælges efter kontrast)
 *   {rolle}-subtle      trin 3   lys flade (info-boks, valgt række)
 *   {rolle}-subtle-hover trin 4  hover på den lyse flade
 *   {rolle}-border      trin 7   kant
 *   {rolle}-ink         trin 11  farvet tekst/ikon på neutrale og subtile flader
 */
function family(name: string, hue: Hue): Record<string, ThemedValue> {
  return {
    [name]: at(hue, 9),
    [`${name}-hover`]: at(hue, 10),
    [`${name}-foreground`]: { auto: at(hue, 9) },
    [`${name}-subtle`]: at(hue, 3),
    [`${name}-subtle-hover`]: at(hue, 4),
    [`${name}-border`]: at(hue, 7),
    [`${name}-ink`]: at(hue, 11),
  };
}

/**
 * En mørk flade med sin egen tekst (app-rammen, fremhævede kort). Hover og
 * dæmpet tekst er blandinger, så de følger fladen, hvis den skifter farve.
 *
 *   {flade}                   fladen
 *   {flade}-hover             hover og aktivt punkt: 8 % tekstfarve blandet i fladen
 *   {flade}-sunken            nedsænket i fladen (ikon-skiver, klubbadgen): 30 % sort
 *   {flade}-foreground        tekst (vælges efter kontrast)
 *   {flade}-muted-foreground  dæmpet tekst: 18 % flade blandet i teksten
 *   {flade}-border            skillelinjer: tekstfarven med 10 % dækkeevne
 *   {flade}-ring              fokusring på fladen
 */
function surface(name: string, base: ThemedValue): Record<string, ThemedValue> {
  const foreground = token(`${name}-foreground`);
  return {
    [name]: base,
    [`${name}-hover`]: { mix: [token(name), foreground], amount: 0.08 },
    [`${name}-sunken`]: { mix: [token(name), "black"], amount: 0.3 },
    [`${name}-foreground`]: { auto: token(name) },
    [`${name}-muted-foreground`]: { mix: [foreground, token(name)], amount: 0.18 },
    [`${name}-border`]: { alpha: 0.1, of: foreground },
    [`${name}-ring`]: at(roles.highlight, 9),
  };
}

const shadow = (geometry: string, alpha: number): ShadowLayer => ({
  geometry,
  color: { alpha, of: token("shadow-color") },
});

export const themeDefinition: ThemeDefinition = {
  colors: {
    // Neutrale flader og tekst
    background: { light: neutral(2), dark: neutral(1) },
    foreground: neutral(12),
    card: { light: neutral(1), dark: neutral(2) },
    "card-foreground": neutral(12),
    popover: { light: neutral(1), dark: neutral(3) },
    "popover-foreground": neutral(12),
    muted: neutral(3),
    "muted-foreground": neutral(11),
    border: neutral(6),
    /** Input-kanter og andre kanter, der skal ses (≥ 3:1). */
    "border-strong": neutral(8),
    input: token("border-strong"),
    ring: { light: at(roles.highlight, 11), dark: at(roles.highlight, 9) },
    /** Overlay bag dialoger og sheets. */
    scrim: { light: { alpha: 0.5, of: "fixed-dark" }, dark: { alpha: 0.65, of: "black" } },

    // Flader med egen tekst
    ...surface("frame", { light: at(roles.frame, 9), dark: at(roles.frame, 3) }),
    ...surface("feature", { light: at(roles.feature, 9), dark: at(roles.feature, 4) }),
    /** Accent-tekst på feature-fladen (fx "Tema: Belgiske øl" på hero'en). */
    "feature-highlight": at(roles.highlight, 10),

    // Handlinger og status
    ...family("primary", roles.primary),
    ...family("highlight", roles.highlight),
    ...family("info", roles.info),
    ...family("success", roles.success),
    ...family("destructive", roles.destructive),

    // shadcn-aliaser (components/ui)
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
    /** Avatarernes initial-farver (UserAvatar). Tekst: avatar-foreground. */
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
  },

  vars: {
    /** Porthole-ringen (SPEC §13.1): ringens farve og spalten mellem ring og indhold. */
    "porthole-ring": at(roles.highlight, 9),
    "porthole-gap": token("card"),
    /** Farven i alle skygger. */
    "shadow-color": { light: at(roles.frame, 10), dark: "black" },
  },

  shadows: {
    /** Kort på baggrunden. */
    raised: [shadow("0 10px 24px -20px", 0.7)],
    /** Dropdowns og toasts. */
    floating: [shadow("0 18px 40px -16px", 0.5)],
    /** Dialoger, sheets og login-kortet. */
    overlay: [shadow("0 30px 60px -24px", 0.6)],
    /** Fremhævede kort (hero, afstemningens resultat). */
    hero: [shadow("0 22px 44px -26px", 0.95)],
    /** Bundnavigationen (skygge opad). */
    bar: [shadow("0 -12px 30px -18px", 0.7)],
    /** Solide knappers "kant" forneden. */
    press: [{ geometry: "inset 0 -2px 0", color: { alpha: 0.2, of: "black" } }],
  },
};
