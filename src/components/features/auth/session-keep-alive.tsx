"use client";

import { useEffect, useRef } from "react";

import { authClient } from "@/lib/auth-client";

/**
 * Slides the session forward (D-030). Rendered by <SessionRefresh /> only when
 * a refresh is due. On mount it calls GET /api/auth/get-session: that Route
 * Handler moves the expiry in the database AND re-issues the session cookie
 * (Max-Age 60 days), which a Server Component cannot do. Renders nothing.
 */
export function SessionKeepAlive() {
  // Once per mount, also under React Strict Mode's double effects in development.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // Best effort: a failed refresh only means the session is refreshed next time.
    void authClient.getSession().catch(() => {});
  }, []);

  return null;
}
