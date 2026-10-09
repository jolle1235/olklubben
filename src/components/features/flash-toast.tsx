"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

import { flashToastMessage, searchWithoutToast, TOAST_PARAM } from "@/lib/flash-toast";

/**
 * Shows the toast a Server Action asked for with `?toast=<key>` on its
 * redirect target (src/lib/flash-toast.ts: withToast), then removes the flag
 * from the address bar, so a refresh, the back button or a shared link does
 * not toast again. Unknown keys are ignored (and left in the URL).
 *
 * Mounted once in the club layout. The layout is not re-rendered between
 * pages, but this component is: useSearchParams() follows every navigation,
 * including a redirect. The toast has a fixed id per key, so React's double
 * effects in development show it once. Renders nothing.
 */
export function FlashToast() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const key = searchParams.get(TOAST_PARAM);
  const message = flashToastMessage(key);

  useEffect(() => {
    if (key === null || message === null) return;
    toast.success(message, { id: `flash:${key}` });

    // Native history calls are synced with Next's router (no server request).
    window.history.replaceState(
      null,
      "",
      `${pathname}${searchWithoutToast(window.location.search)}${window.location.hash}`,
    );
  }, [key, message, pathname]);

  return null;
}
