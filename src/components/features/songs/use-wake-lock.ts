"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/** What the reader exposes as data-wake-lock (also for tests). */
export type WakeLockStatus = "pending" | "active" | "unsupported" | "denied";

const noopSubscribe = () => () => {};
const isSupported = () => "wakeLock" in navigator;

/**
 * Keeps the screen on while a song is open (SPEC §9.6), so the phone does
 * not dim mid-verse. Asks on mount when the page is visible and again when it
 * becomes visible (the browser drops the lock when the tab is hidden).
 * Releases on unmount. Unsupported browsers, a refusal and low battery are
 * silent: there is no UI.
 */
export function useWakeLock(): WakeLockStatus {
  const supported = useSyncExternalStore(noopSubscribe, isSupported, () => null);
  const [status, setStatus] = useState<"pending" | "active" | "denied">("pending");

  useEffect(() => {
    if (!supported) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    async function request() {
      if (cancelled || sentinel !== null || document.visibilityState !== "visible") return;
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void lock.release().catch(() => {});
          return;
        }
        sentinel = lock;
        lock.addEventListener("release", () => {
          if (sentinel === lock) sentinel = null;
        });
        setStatus("active");
      } catch {
        if (!cancelled) setStatus("denied");
      }
    }

    const onVisibilityChange = () => void request();
    void request();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      const lock = sentinel;
      sentinel = null;
      void lock?.release().catch(() => {});
    };
  }, [supported]);

  if (supported === null) return "pending";
  return supported ? status : "unsupported";
}
