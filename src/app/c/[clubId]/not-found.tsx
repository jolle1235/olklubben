import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * 404 inside a club (SPEC §4.4, §13.5): a resource that does not exist in this
 * club, an unknown path below the club ([...rest]), or a member who was just
 * removed (E16; their next club page 404s).
 * Links to "/", which routes to the right place (§10.1). A non-member's first
 * request is stopped by the club layout and gets the root 404 instead.
 */
export default function ClubNotFound() {
  return (
    <EmptyState
      as="h1"
      icon={<span className="font-display text-xl font-bold text-amber-ink">404</span>}
      title="Den her øl er vist drukket."
      description="Siden findes ikke. Måske er linket gammelt, eller også er siden flyttet."
      actions={
        <Button asChild>
          <Link href="/">Gå til forsiden</Link>
        </Button>
      }
    />
  );
}
