import Link from "next/link";
import { CalendarDaysIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export type NoEventsStateProps = {
  newEventHref: string;
  /**
   * Show "Opret event" as a secondary (outline) button, when something else on
   * the screen is the primary action, e.g. the invitation card's "Del" while
   * the club has one member. One primary action per screen (SPEC §13.4, D-057).
   */
  deemphasize?: boolean;
};

/**
 * Overblik with no upcoming or ongoing event (SPEC §9.1 empty states, §13.5).
 * "Planlæg ølsmagning" joins [Opret event] when polls arrive (round 4).
 */
export function NoEventsState({ newEventHref, deemphasize = false }: NoEventsStateProps) {
  return (
    <EmptyState
      icon={<CalendarDaysIcon />}
      title="Ingen kommende ølsmagninger endnu 🍺"
      description="Sæt en dato i kalenderen, så I har noget at glæde jer til."
      actions={
        <Button
          asChild
          size={deemphasize ? "default" : "lg"}
          variant={deemphasize ? "outline" : "default"}
        >
          <Link href={newEventHref}>
            <PlusIcon aria-hidden />
            Opret event
          </Link>
        </Button>
      }
    />
  );
}
