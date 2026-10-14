"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** How often an open poll re-renders while it is on screen (D-136). */
export const POLL_REFRESH_MS = 30_000;

export type PollAutoRefreshProps = { active: boolean };

/** A form on the page has unsaved changes (the vote form sets data-dirty). */
function hasDirtyForm(): boolean {
  return document.querySelector('form[data-dirty="true"]') !== null;
}

/**
 * Keeps an open poll fresh (SPEC §9.7.3, D-136): router.refresh() every 30 s
 * while the page is visible, and once when it becomes visible again – the
 * other members' votes appear, and at the deadline the refresh runs the
 * page's lazy close. Paused while the vote form has unsaved ticks
 * (data-dirty), so a refresh never fights the member (the form is keyed on
 * the saved ballot and keeps its draft anyway). Renders nothing.
 */
export function PollAutoRefresh({ active }: PollAutoRefreshProps): null {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const refresh = () => {
      if (document.visibilityState === "visible" && !hasDirtyForm()) router.refresh();
    };
    const timer = window.setInterval(refresh, POLL_REFRESH_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active, router]);

  return null;
}
