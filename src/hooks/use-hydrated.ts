"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * False on the server and during hydration, true after. Controls that show a
 * per-device setting from <html> (the songbook reader, Udseende on Profil)
 * stay disabled until then, so they never show the server's default as the
 * choice (TG-020).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
