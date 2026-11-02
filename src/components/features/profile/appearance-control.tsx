"use client";

import { setThemePref, useThemePref } from "@/components/features/theme/use-theme-pref";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useHydrated } from "@/hooks/use-hydrated";
import type { ThemePref } from "@/lib/theme-prefs";

const OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Lyst" },
  { value: "dark", label: "Mørkt" },
] as const satisfies readonly { value: ThemePref; label: string }[];

/**
 * Udseende on Profil (SPEC §9.8): System | Lyst | Mørkt, remembered per
 * device. Switches at once, without a save button. Disabled until hydrated,
 * so it never shows the server's default as the choice (TG-020).
 */
export function AppearanceControl() {
  const pref = useThemePref();
  const hydrated = useHydrated();

  return (
    <SegmentedControl
      label="Udseende"
      options={OPTIONS}
      value={hydrated ? pref : null}
      disabled={!hydrated}
      onChange={setThemePref}
    />
  );
}
