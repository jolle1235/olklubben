"use client";

import { Loader2Icon } from "lucide-react";
import { useLinkStatus } from "next/link";

import { cn } from "@/lib/utils";

/**
 * Pending feedback for a <Link> whose target has no skeleton, so the old page
 * stays on screen until the new one arrives: links that re-render the same
 * page (the calendar's ‹ ›, [I dag], the view toggle) and links to pages that
 * may 404 on their own permission check and therefore have no loading.tsx
 * (edit pages, TG-008). On a slow connection this is the only sign that the
 * tap worked. Both must be rendered inside the <Link> (useLinkStatus).
 */

/** The link's content pulses while pending. Always rendered (no layout shift). */
export function LinkPending({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[inherit] transition-opacity",
        pending && "animate-pulse opacity-50",
      )}
    >
      {children}
    </span>
  );
}

/** The link's icon is swapped for a spinner while pending (buttons like "Rediger"). */
export function LinkPendingIcon({ icon }: { icon: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return pending ? <Loader2Icon aria-hidden className="animate-spin" /> : icon;
}
