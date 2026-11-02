import { BROWSER_THEME_COLOR } from "@/styles/tokens/browser-colors";

/**
 * The colour theme (SPEC §13.2, §9.8 "Udseende"): System, Lyst or Mørkt,
 * remembered PER DEVICE in localStorage. "System" follows the phone's or
 * computer's dark mode, also when it changes while the app is open.
 *
 * Two attributes on <html>:
 *   data-theme       "light" | "dark": what the CSS keys on (tokens.css)
 *   data-theme-pref  "system" | "light" | "dark": the choice, for the control on Profil
 *
 * THEME_BOOTSTRAP sets both in the root layout's <head>, before the first
 * paint, so the page never flashes in the wrong theme. The hook in
 * components/features/theme/use-theme-pref.ts reads and writes the same
 * attributes. Every storage access is wrapped in try/catch (private mode,
 * blocked storage): "system" applies.
 *
 * Pure module: client-safe, no React.
 */

export const THEME_PREFS = ["system", "light", "dark"] as const;
export type ThemePref = (typeof THEME_PREFS)[number];
export type ResolvedTheme = Exclude<ThemePref, "system">;
export const DEFAULT_THEME_PREF: ThemePref = "system";

export const THEME_PREF_KEY = "olklubben.theme";
export const THEME_ATTRIBUTE = "data-theme";
export const THEME_PREF_ATTRIBUTE = "data-theme-pref";
export const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";

/** A stored or attribute value → a valid choice; anything else gives "system". */
export function parseThemePref(value: string | null | undefined): ThemePref {
  return value === "light" || value === "dark" || value === "system" ? value : DEFAULT_THEME_PREF;
}

/** The theme a choice shows, given whether the system is in dark mode. */
export function resolveTheme(pref: ThemePref, systemDark: boolean): ResolvedTheme {
  if (pref === "system") return systemDark ? "dark" : "light";
  return pref;
}

/**
 * Marks the theme-color <meta> this module adds for an explicit choice. The
 * root layout's own two (viewport.themeColor, one per prefers-color-scheme)
 * are never touched: React hydrates those, and editing them makes it insert
 * duplicates.
 */
export const THEME_COLOR_OVERRIDE_ATTRIBUTE = "data-theme-override";

/**
 * The constant script in the root layout's <head>. Built from the constants
 * above, so it cannot drift from parseThemePref/resolveTheme. It applies the
 * theme again when the system theme changes (reading the choice from
 * data-theme-pref, which the hook updates). For an explicit choice it puts its
 * own theme-color first in <head> (the browser uses the first match), so the
 * status bar follows the choice even when it differs from the system; for
 * "System" the layout's media-query metas apply. React 19 skips unknown tags
 * in <head> when it hydrates, but hoists its own metas in front of it, so
 * ThemePrefsScript moves it first again after hydration (syncBrowserThemeColor).
 */
export const THEME_BOOTSTRAP = `(function(){try{var d=document.documentElement,m=window.matchMedia(${JSON.stringify(
  DARK_SCHEME_QUERY,
)}),p=null,c=${JSON.stringify(BROWSER_THEME_COLOR)};try{p=localStorage.getItem(${JSON.stringify(
  THEME_PREF_KEY,
)})}catch(e){}if(p!=="light"&&p!=="dark")p="system";d.setAttribute(${JSON.stringify(
  THEME_PREF_ATTRIBUTE,
)},p);var a=function(){var q=d.getAttribute(${JSON.stringify(
  THEME_PREF_ATTRIBUTE,
)}),x=q==="light"||q==="dark",t=x?q:m.matches?"dark":"light";d.setAttribute(${JSON.stringify(
  THEME_ATTRIBUTE,
)},t);var e=document.querySelector("meta[${THEME_COLOR_OVERRIDE_ATTRIBUTE}]");if(x){if(!e){e=document.createElement("meta");e.setAttribute("name","theme-color");e.setAttribute(${JSON.stringify(
  THEME_COLOR_OVERRIDE_ATTRIBUTE,
)},"");document.head.prepend(e)}e.setAttribute("content",c[t])}else if(e)e.remove()};a();m.addEventListener("change",a)}catch(e){}})();`;

/**
 * Points the browser's theme-color (status bar, address bar) at the choice,
 * like THEME_BOOTSTRAP: an override meta for "light"/"dark", none for "system".
 */
export function syncBrowserThemeColor(pref: ThemePref): void {
  let meta = document.querySelector(`meta[${THEME_COLOR_OVERRIDE_ATTRIBUTE}]`);
  if (pref === "system") {
    meta?.remove();
    return;
  }
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    meta.setAttribute(THEME_COLOR_OVERRIDE_ATTRIBUTE, "");
  }
  meta.setAttribute("content", BROWSER_THEME_COLOR[pref]);
  // First in <head> (again): hydration hoists the layout's own metas to the front.
  document.head.prepend(meta);
}
