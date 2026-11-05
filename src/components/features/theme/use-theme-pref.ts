"use client";

import { createHtmlPref, useHtmlPref } from "@/hooks/use-html-pref";
import {
  applyThemePref,
  DARK_SCHEME_QUERY,
  parseThemePref,
  resolveTheme,
  THEME_ATTRIBUTE,
  THEME_PREF_KEY,
  type ThemePref,
} from "@/lib/theme-prefs";

export const themePref = createHtmlPref({
  attribute: THEME_ATTRIBUTE,
  storageKey: THEME_PREF_KEY,
  parse: parseThemePref,
  apply: applyThemePref,
});

export function useThemePref(): ThemePref | null {
  return useHtmlPref(themePref);
}

/** Fades only when the visible theme changes. */
export function setThemePref(pref: ThemePref) {
  const systemDark = window.matchMedia(DARK_SCHEME_QUERY).matches;
  const update = () => themePref.set(pref);
  if (resolveTheme(themePref.read(), systemDark) === resolveTheme(pref, systemDark)) update();
  else crossfade(update);
}

/** No sudden jump in brightness (SPEC §13.2). Duration in globals.css (::view-transition-*). */
function crossfade(update: () => void) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion || typeof document.startViewTransition !== "function") update();
  else document.startViewTransition(update);
}
