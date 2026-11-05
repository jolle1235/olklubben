"use client";

import { useEffect } from "react";

import { HeadScript } from "@/components/features/head-script";
import { applyThemePref, THEME_BOOTSTRAP } from "@/lib/theme-prefs";

import { themePref } from "./use-theme-pref";

/**
 * After hydration it applies the choice again: React hoists the layout's own
 * theme-color metas in front of the override (F-090).
 */
export function ThemePrefsScript() {
  useEffect(() => {
    applyThemePref(themePref.read());
  }, []);

  return <HeadScript code={THEME_BOOTSTRAP} />;
}
