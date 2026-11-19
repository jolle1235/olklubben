"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { overviewHref } from "@/lib/routes";

/** Once per document: the page the browser loaded is the only one the worker may have served. */
let askedThisDocument = false;

/**
 * The other half of public/sw.js (D-185), in the club layout. Renders nothing.
 *
 * - Tells the worker which club is on screen, so opening the app at "/" next
 *   time goes straight to its cached Overblik.
 * - Asks the worker how this document was served (the worker alone knows which
 *   pages it caches). When it came from the cache, the worker answers once the
 *   fresh page is stored, and
 *   router.refresh() swaps the fresh data in. "unknown" (the worker restarted
 *   meanwhile) refreshes too; "network" means the page is already fresh.
 *
 * Only runs when a worker controls the page (production builds). A Link
 * prefetch renders the layout but mounts nothing, so this never runs for it.
 */
export function CachedPageRefresh({ clubId }: { clubId: string }) {
  const router = useRouter();

  useEffect(() => {
    const worker = navigator.serviceWorker?.controller;
    if (!worker) return;
    const overviewPath = overviewHref(clubId);
    worker.postMessage({ type: "last-club", path: overviewPath });

    if (askedThisDocument) return;
    askedThisDocument = true;

    const channel = new MessageChannel();
    channel.port1.onmessage = (event: MessageEvent<string>) => {
      channel.port1.close();
      if (event.data !== "network") router.refresh();
    };
    const url = window.location.pathname + window.location.search;
    worker.postMessage({ type: "revalidated?", url }, [channel.port2]);
  }, [clubId, router]);

  return null;
}
