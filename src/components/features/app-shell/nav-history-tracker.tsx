"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { readNavHistory, recordVisit, writeNavHistory } from "@/lib/nav-history";

/**
 * Records every in-app page (path + query) in the tab's history for
 * "Tilbage" on the event page (lib/nav-history.ts, D-179). Renders nothing.
 */
export function NavHistoryTracker() {
  return (
    <Suspense fallback={null}>
      <Track />
    </Suspense>
  );
}

function Track() {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    writeNavHistory(recordVisit(readNavHistory(), search ? `${pathname}?${search}` : pathname));
  }, [pathname, search]);

  return null;
}
