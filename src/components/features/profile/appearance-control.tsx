"use client";

import { setThemePref, useThemePref } from "@/components/features/theme/use-theme-pref";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { ThemePref } from "@/lib/theme-prefs";

const OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Lyst" },
  { value: "dark", label: "Mørkt" },
] as const satisfies readonly { value: ThemePref; label: string }[];

/**
 * Udseende on Profil (SPEC §9.8): System | Lyst | Mørkt, remembered per
 * device. Switches at once, without a save button. Disabled until hydrated
 * (useThemePref is null until then), so it never shows a guess as the
 * choice (TG-020).
 */
export function AppearanceControl() {
  const pref = useThemePref();

  return (
    <SegmentedControl
      label="Udseende"
      options={OPTIONS}
      value={pref}
      disabled={pref === null}
      onChange={setThemePref}
    />
  );
}
