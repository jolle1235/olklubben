"use client";

import { useEffect } from "react";

import {
  parseThemePref,
  syncBrowserThemeColor,
  THEME_BOOTSTRAP,
  THEME_PREF_ATTRIBUTE,
} from "@/lib/theme-prefs";

/**
 * The colour theme on <html> before the first paint (src/lib/theme-prefs.ts),
 * so a page never flashes in the wrong theme. A constant string, rendered
 * like SongbookPrefsScript: a normal inline script in the server HTML, an
 * inert data block on the client (F-071).
 *
 * After hydration it puts the theme-color override first in <head> again:
 * React hoists the layout's own theme-color metas in front of it.
 */
export function ThemePrefsScript() {
  const isServer = typeof window === "undefined";

  useEffect(() => {
    syncBrowserThemeColor(
      parseThemePref(document.documentElement.getAttribute(THEME_PREF_ATTRIBUTE)),
    );
  }, []);

  return (
    <script
      type={isServer ? undefined : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }}
    />
  );
}
