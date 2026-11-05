"use client";

import { useEffect } from "react";

import { HeadScript } from "@/components/features/head-script";
import { THEME_BOOTSTRAP } from "@/lib/theme-prefs";

import { themePref } from "./use-theme-pref";

/**
 * After hydration it applies the stored choice again: React hoists the layout's
 * own theme-color metas in front of the override (F-090), and a client-rendered
 * document (a 404, GlobalError) starts without the attribute and with an inert
 * script (F-071).
 */
export function ThemePrefsScript() {
  useEffect(() => {
    themePref.restore();
  }, []);

  return <HeadScript code={THEME_BOOTSTRAP} />;
}
