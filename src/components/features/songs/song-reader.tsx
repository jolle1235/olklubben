"use client";

import { useWakeLock } from "./use-wake-lock";

/**
 * The reader's frame: keeps the screen on while the song is open (Wake Lock,
 * SPEC §9.6) and exposes the state as data-wake-lock. The song itself is
 * server HTML passed as children.
 */
export function SongReader({ children }: { children: React.ReactNode }) {
  const wakeLock = useWakeLock();
  return (
    <article className="grid grid-cols-1" data-wake-lock={wakeLock}>
      {children}
    </article>
  );
}
