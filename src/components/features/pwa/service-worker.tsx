"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js (SPEC §13.6, D-185) in production builds. Everywhere
 * else (next dev, E2E, verify instances) it removes a worker a local
 * `next start` may have left on the same origin, so development never runs on
 * cached pages. Renders nothing; in the root layout.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "production") {
      // Best effort: without the worker the app works as before, just without the instant open.
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {});
    } else {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => registrations.forEach((registration) => registration.unregister()))
        .catch(() => {});
    }
  }, []);

  return null;
}
