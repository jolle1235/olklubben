import { BROWSER_THEME_COLOR } from "@/styles/tokens/browser-colors";
import { DARK_SCHEME_QUERY, THEME_ATTRIBUTE } from "@/styles/tokens/theme-attribute";

export { DARK_SCHEME_QUERY, THEME_ATTRIBUTE };

/**
 * The colour theme (SPEC §13.2), remembered per device: data-theme="light" |
 * "dark" on <html>, or none for "System", where tokens.css follows the device.
 */

export const THEME_PREFS = ["system", "light", "dark"] as const;
export type ThemePref = (typeof THEME_PREFS)[number];
export type ResolvedTheme = Exclude<ThemePref, "system">;

export const THEME_PREF_KEY = "olklubben.theme";

/**
 * Marks the theme-color <meta> applyThemePref adds. The layout's own are never
 * edited: React hydrates them and would insert duplicates (F-090).
 */
export const THEME_COLOR_OVERRIDE_ATTRIBUTE = "data-theme-override";

type ThemeDom = {
  attribute: string;
  overrideAttribute: string;
  colors: Record<ResolvedTheme, string>;
};

const THEME_DOM: ThemeDom = {
  attribute: THEME_ATTRIBUTE,
  overrideAttribute: THEME_COLOR_OVERRIDE_ATTRIBUTE,
  colors: BROWSER_THEME_COLOR,
};

/** Self-contained: THEME_BOOTSTRAP inlines its source. */
export function parseThemePref(value: string | null | undefined): ThemePref {
  return value === "light" || value === "dark" ? value : "system";
}

export function resolveTheme(pref: ThemePref, systemDark: boolean): ResolvedTheme {
  if (pref === "system") return systemDark ? "dark" : "light";
  return pref;
}

export function applyThemePref(pref: ThemePref): void {
  applyThemePrefWith(pref, THEME_DOM);
}

/** Self-contained (only its parameters and the DOM): THEME_BOOTSTRAP inlines its source. */
function applyThemePrefWith(pref: ThemePref, dom: ThemeDom): void {
  const root = document.documentElement;
  let meta = document.querySelector(`meta[${dom.overrideAttribute}]`);
  if (pref === "system") {
    root.removeAttribute(dom.attribute);
    if (meta) meta.remove();
    return;
  }
  root.setAttribute(dom.attribute, pref);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    meta.setAttribute(dom.overrideAttribute, "");
  }
  meta.setAttribute("content", dom.colors[pref]);
  // First in <head>, even when already there: the browser uses the first match (F-090).
  document.head.prepend(meta);
}

/** Runs in the root layout's <head>, so the first paint has the right theme. */
export const THEME_BOOTSTRAP = `(function(){try{var p=null;try{p=localStorage.getItem(${JSON.stringify(
  THEME_PREF_KEY,
)})}catch(e){}(${applyThemePrefWith.toString()})((${parseThemePref.toString()})(p),${JSON.stringify(
  THEME_DOM,
)})}catch(e){}})();`;
