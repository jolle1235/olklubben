"use client";

import { useSyncExternalStore } from "react";

import {
  DARK_SCHEME_QUERY,
  DEFAULT_THEME_PREF,
  parseThemePref,
  resolveTheme,
  syncBrowserThemeColor,
  THEME_ATTRIBUTE,
  THEME_PREF_ATTRIBUTE,
  THEME_PREF_KEY,
  type ThemePref,
} from "@/lib/theme-prefs";

/**
 * The colour theme choice (src/lib/theme-prefs.ts), read from and written to
 * the <html> attributes the head bootstrap set before the first paint. The
 * server snapshot is the default, so the control never mismatches on
 * hydration. A write also goes to localStorage (try/catch: private mode keeps
 * it for this page only); the bootstrap's listener reads data-theme-pref, so
 * "System" keeps following later system changes.
 */

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const readPref = () => parseThemePref(document.documentElement.getAttribute(THEME_PREF_ATTRIBUTE));

export function setThemePref(pref: ThemePref) {
  const root = document.documentElement;
  const theme = resolveTheme(pref, window.matchMedia(DARK_SCHEME_QUERY).matches);
  root.setAttribute(THEME_PREF_ATTRIBUTE, pref);
  root.setAttribute(THEME_ATTRIBUTE, theme);
  syncBrowserThemeColor(pref);
  try {
    window.localStorage.setItem(THEME_PREF_KEY, pref);
  } catch {
    // Storage blocked: the attributes still apply until the next hard load.
  }
  for (const listener of listeners) listener();
}

export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribe, readPref, () => DEFAULT_THEME_PREF);
}
