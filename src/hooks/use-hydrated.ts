"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * False on the server and during hydration, true after: for a control that
 * only works with JavaScript and stays disabled until then (TG-020), e.g.
 * "Forhåndsvis" in SongForm. A per-device setting from <html> gets the same
 * from useHtmlPref, which is null until hydrated.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
