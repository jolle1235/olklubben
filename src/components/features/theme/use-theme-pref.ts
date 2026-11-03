"use client";

import { createHtmlPref, useHtmlPref } from "@/hooks/use-html-pref";
import {
  applyThemePref,
  DARK_SCHEME_QUERY,
  parseThemePref,
  resolveTheme,
  THEME_ATTRIBUTE,
  THEME_DOM,
  THEME_PREF_KEY,
  type ThemePref,
} from "@/lib/theme-prefs";

/**
 * The colour theme choice (src/lib/theme-prefs.ts) as a per-device setting on
 * <html>: data-theme, which the head bootstrap set before the first paint.
 */
export const themePref = createHtmlPref({
  attribute: THEME_ATTRIBUTE,
  storageKey: THEME_PREF_KEY,
  parse: parseThemePref,
  apply: (pref) => applyThemePref(pref, THEME_DOM),
});

/** The choice, or null until hydrated. */
export function useThemePref(): ThemePref | null {
  return useHtmlPref(themePref);
}

/** Applies and remembers a choice; fades when the page changes between light and dark. */
export function setThemePref(pref: ThemePref) {
  const systemDark = window.matchMedia(DARK_SCHEME_QUERY).matches;
  const update = () => themePref.set(pref);
  if (resolveTheme(themePref.read(), systemDark) === resolveTheme(pref, systemDark)) update();
  else crossfade(update);
}

/**
 * A new theme fades in instead of the whole screen jumping from light to dark
 * in one frame (SPEC §13.2; Apple: no sudden jumps in brightness). The
 * duration is in globals.css (::view-transition-*). Instant when the member
 * asked for less motion or the browser has no View Transitions.
 */
function crossfade(update: () => void) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion || typeof document.startViewTransition !== "function") update();
  else document.startViewTransition(update);
}
