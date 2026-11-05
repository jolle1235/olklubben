"use client";

import { Toaster } from "@/components/ui/sonner";

import { useThemePref } from "./use-theme-pref";

/** Sonner's own styles (close button, grays) follow the chosen theme. */
export function ThemedToaster() {
  return <Toaster theme={useThemePref() ?? "system"} />;
}
