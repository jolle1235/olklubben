import Link from "next/link";
import { ArrowRightIcon, BeerIcon, MusicIcon } from "lucide-react";

import type { CalendarEvent } from "@/components/features/calendar/event-format";
import { Button } from "@/components/ui/button";
import { eventHref, newBeerHref, songsHref } from "@/lib/routes";
import { cn } from "@/lib/utils";

/** A quiet button on the feature card (feature text, thin muted border). */
const ON_HARBOR_OUTLINE =
  "border-feature-muted-foreground/45 bg-transparent text-feature-foreground hover:border-feature-muted-foreground hover:bg-feature-hover aria-expanded:bg-feature-hover";

export type HeroActionsProps = {
  clubId: string;
  event: Pick<CalendarEvent, "id">;
  /** The event is on now: [Tilføj øl] and [Sangbog] come first (SPEC §9.1). */
  ongoing: boolean;
  /** Another card holds the screen's primary action (D-057): no highlight button. */
  quiet: boolean;
};

/**
 * The hero card's buttons (SPEC §9.1). Normally one highlight [Se event]. While
 * the event is on: [Tilføj øl] (pre-filled with the event, SPEC §10.5),
 * [Sangbog] and a quieter [Se event]. Built for the feature card.
 */
export function HeroActions({ clubId, event, ongoing, quiet }: HeroActionsProps) {
  const href = eventHref(clubId, event.id);
  const primaryVariant = quiet ? "outline" : "highlight";
  const primaryClass = quiet ? ON_HARBOR_OUTLINE : undefined;

  if (!ongoing) {
    return (
      <div className="mt-6 flex">
        <Button
          asChild
          size="lg"
          variant={primaryVariant}
          className={cn("w-full sm:w-auto", primaryClass)}
        >
          <Link href={href}>
            Se event
            <ArrowRightIcon aria-hidden data-icon="inline-end" />
          </Link>
        </Button>
      </div>
    );
  }

  // During the tasting: add the beer you are drinking, open the songbook.
  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
      <Button asChild size="lg" variant={primaryVariant} className={cn("px-4", primaryClass)}>
        <Link href={newBeerHref(clubId, { eventId: event.id })}>
          <BeerIcon aria-hidden />
          Tilføj øl
        </Link>
      </Button>
      <Button asChild size="lg" variant="outline" className={cn("px-4", ON_HARBOR_OUTLINE)}>
        <Link href={songsHref(clubId)}>
          <MusicIcon aria-hidden />
          Sangbog
        </Link>
      </Button>
      <Button
        asChild
        size="lg"
        variant="ghost"
        className="col-span-2 text-feature-foreground hover:bg-feature-hover sm:col-span-1"
      >
        <Link href={href}>
          Se event
          <ArrowRightIcon aria-hidden data-icon="inline-end" />
        </Link>
      </Button>
    </div>
  );
}
