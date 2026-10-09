import type { Metadata } from "next";
import Link from "next/link";

import { CenteredShell } from "@/components/features/centered-shell";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Siden findes ikke" };

export default function NotFound() {
  return (
    <CenteredShell>
      <div className="flex flex-col items-center text-center">
        <p
          aria-hidden
          className="font-display text-7xl leading-none font-bold tracking-tight text-amber-ink"
        >
          404
        </p>
        <h1 className="mt-4 text-[1.85rem] leading-tight font-bold text-olive">
          Den her øl er vist drukket.
        </h1>
        <p className="mt-2 text-[1.05rem] text-muted-foreground">
          Siden findes ikke. Måske er linket gammelt, eller også er siden flyttet.
        </p>
        <Button asChild className="mt-7 w-full sm:w-auto">
          <Link href="/">Gå til forsiden</Link>
        </Button>
      </div>
    </CenteredShell>
  );
}
