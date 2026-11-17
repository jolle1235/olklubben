"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * ↻ next to "Øl smagt til dette event" (SPEC §9.2): fetches the others'
 * latest ratings and beers without reloading the page (router.refresh). The
 * icon turns while the new render is on its way.
 */
export function RefreshBeersButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      aria-label="Hent nye ratings"
      aria-busy={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      <RefreshCwIcon aria-hidden className={cn(pending && "motion-safe:animate-spin")} />
    </Button>
  );
}
