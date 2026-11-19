import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { TopBarTitle } from "@/components/ui/top-bar-title";

const TITLE = "Den her øl er vist drukket.";

/**
 * 404 inside a club (SPEC §4.4, §13.5): a resource that does not exist in this
 * club, an unknown path below the club ([...rest]), or a member who was just
 * removed (E16; their next club page 404s).
 * Links to "/", which routes to the right place (§10.1). A non-member's first
 * request is stopped by the club layout and gets the root 404 instead.
 */
export default function ClubNotFound() {
  return (
    <>
      {/* Mobile: the page's name next to "‹ Tilbage", like every subpage (D-182). */}
      <TopBarTitle>{TITLE}</TopBarTitle>
      <EmptyState
        as="h1"
        icon={<span className="font-display text-title-sm font-bold text-highlight-ink">404</span>}
        title={TITLE}
        description="Siden findes ikke. Måske er linket gammelt, eller også er siden flyttet."
        actions={
          <Button asChild>
            <Link href="/">Gå til forsiden</Link>
          </Button>
        }
      />
    </>
  );
}
