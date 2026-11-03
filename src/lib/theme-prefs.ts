import { BROWSER_THEME_COLOR } from "@/styles/tokens/browser-colors";
import { DARK_SCHEME_QUERY, THEME_ATTRIBUTE } from "@/styles/tokens/theme-attribute";

export { DARK_SCHEME_QUERY, THEME_ATTRIBUTE };

/**
 * The colour theme (SPEC §13.2, §9.8 "Udseende"): System, Lyst or Mørkt,
 * remembered PER DEVICE in localStorage.
 *
 * The choice is one attribute on <html>: data-theme="light" | "dark", or none
 * for "System". tokens.css shows the dark theme for data-theme="dark" and,
 * without a choice, while the device is in dark mode, so "System" needs no
 * script and follows the device also while the app is open.
 *
 * applyThemePref puts a choice on the page. THEME_BOOTSTRAP runs the same
 * code in the root layout's <head> before the first paint, so the page
 * never flashes in the wrong theme; the hook in
 * components/features/theme/use-theme-pref.ts runs it on a change. Every
 * storage access is wrapped in try/catch (private mode, blocked storage):
 * "system" applies.
 *
 * Pure module: client-safe, no React.
 */

export const THEME_PREFS = ["system", "light", "dark"] as const;
export type ThemePref = (typeof THEME_PREFS)[number];
export type ResolvedTheme = Exclude<ThemePref, "system">;

export const THEME_PREF_KEY = "olklubben.theme";

/**
 * Marks the theme-color <meta> applyThemePref adds for an explicit choice. The
 * root layout's own two (viewport.themeColor, one per prefers-color-scheme)
 * are never touched: React hydrates those, and editing them makes it insert
 * duplicates (F-090).
 */
export const THEME_COLOR_OVERRIDE_ATTRIBUTE = "data-theme-override";

/** What applyThemePrefWith needs from the page: it may only use its parameters. */
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

/**
 * A stored or attribute value → a valid choice; anything else (also none)
 * gives "system". Self-contained: THEME_BOOTSTRAP inlines it.
 */
export function parseThemePref(value: string | null | undefined): ThemePref {
  return value === "light" || value === "dark" ? value : "system";
}

/** The theme a choice shows, given whether the device is in dark mode. */
export function resolveTheme(pref: ThemePref, systemDark: boolean): ResolvedTheme {
  if (pref === "system") return systemDark ? "dark" : "light";
  return pref;
}

/**
 * Puts a choice on the page: data-theme for "light"/"dark", none for "system"
 * (tokens.css then follows the device). For an explicit choice it also puts
 * its own theme-color first in <head> (the browser uses the first match), so
 * the status bar follows the choice even when it differs from the device; for
 * "system" it removes it, and the layout's prefers-color-scheme metas apply.
 */
export function applyThemePref(pref: ThemePref): void {
  applyThemePrefWith(pref, THEME_DOM);
}

/**
 * applyThemePref's body, self-contained (only its parameters and the DOM):
 * THEME_BOOTSTRAP inlines its source, so the head script and a change on
 * Profil run the same code.
 */
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
  // First in <head> (again): React hoists the layout's own metas to the front when it hydrates.
  document.head.prepend(meta);
}

/**
 * The constant script in the root layout's <head>: reads the stored choice and
 * runs parseThemePref and applyThemePrefWith, inlined from their source.
 */
export const THEME_BOOTSTRAP = `(function(){try{var p=null;try{p=localStorage.getItem(${JSON.stringify(
  THEME_PREF_KEY,
)})}catch(e){}(${applyThemePrefWith.toString()})((${parseThemePref.toString()})(p),${JSON.stringify(
  THEME_DOM,
)})}catch(e){}})();`;
