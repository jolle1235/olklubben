"use client";

import { useEffect } from "react";

export type ScrollToHashProps = {
  /** The id of the element to show when the URL's hash names it. */
  targetId: string;
};

/**
 * Scrolls `#targetId` into view when the URL's hash is that id. Next.js only
 * scrolls to a hash it finds when the navigation commits; behind a
 * loading.tsx the target streams in later, so "Se alle tidligere" would land
 * at the top of Kalender. Renders nothing; give it a `key` that changes with
 * the content (fx ?past=all), so it runs again.
 */
export function ScrollToHash({ targetId }: ScrollToHashProps) {
  useEffect(() => {
    if (window.location.hash !== `#${targetId}`) return;
    document.getElementById(targetId)?.scrollIntoView({ block: "start" });
  }, [targetId]);
  return null;
}
