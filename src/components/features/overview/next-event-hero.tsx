import { AnchorIcon, ClockIcon, MapPinIcon } from "lucide-react";

import {
  eventWeekdayAndTime,
  type CalendarEvent,
} from "@/components/features/calendar/event-format";
import { BigDate } from "@/components/ui/big-date";
import { cn } from "@/lib/utils";
import {
  heroState,
  heroStateLabel,
  isHeroHighlighted,
  type HeroState,
} from "@/server/domain/events/status";

import { HeroActions } from "./hero-actions";

export type NextEventHeroProps = {
  clubId: string;
  event: CalendarEvent;
  /** The request's time; decides "om 3 dage", "I morgen!", "I aften! 🍻" or "I gang nu". */
  now: Date;
  /**
   * Another card on the screen holds the primary action (a poll that waits
   * for the viewer, D-057), so the hero's own buttons are quiet.
   */
  quiet?: boolean;
};

/**
 * The next event, big and clear (SPEC §3.2, §9.1): "NÆSTE ØLSMAGNING" with a
 * relative badge, the big date, title, weekday · time, place, theme and
 * [Se event]. While the event is on, the shortcuts [Tilføj øl] (pre-filled
 * with the event) and [Sangbog] come first. A feature card, so it stands apart
 * from the app frame (§13.2).
 */
export function NextEventHero({ clubId, event, now, quiet = false }: NextEventHeroProps) {
  const state = heroState(event, now);
  const highlighted = isHeroHighlighted(state);

  return (
    <section
      aria-labelledby="next-event-label"
      className={cn(
        "relative isolate overflow-hidden rounded-2xl surface-feature px-5 pt-5 pb-6 shadow-hero sm:px-7 md:px-10 md:pt-8 md:pb-10",
        highlighted && "ring-[3px] ring-highlight ring-offset-2 ring-offset-background",
      )}
    >
      <AnchorIcon
        aria-hidden
        strokeWidth={1.1}
        className="pointer-events-none absolute -right-12 -bottom-14 -z-10 size-64 text-feature-hover md:-right-8 md:size-80"
      />

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p
          id="next-event-label"
          className="text-label-md font-bold caps-wide text-feature-muted-foreground"
        >
          Næste ølsmagning
        </p>
        <HeroBadge state={state} />
      </div>

      <div className="mt-5 grid gap-5 md:mt-7 md:grid-cols-[auto_minmax(0,1fr)] md:items-center md:gap-0">
        <BigDate date={event.startsAt} size="lg" className="text-feature-foreground md:pr-10" />

        <div className="min-w-0 md:border-l md:border-feature-border md:pl-10">
          <h2 className="text-headline-md font-bold break-words hyphens-auto text-feature-foreground md:text-headline-lg">
            {event.title}
          </h2>

          <ul className="mt-3 flex flex-col gap-1.5 text-body-lg text-feature-foreground">
            <li className="flex items-center gap-2.5">
              <ClockIcon aria-hidden className="size-5 shrink-0 text-highlight" />
              {eventWeekdayAndTime(event)}
            </li>
            <li className="flex items-start gap-2.5">
              <MapPinIcon aria-hidden className="mt-1 size-5 shrink-0 text-highlight" />
              <span className="min-w-0 break-words">
                <span className="sr-only">Sted: </span>
                {event.place.name}
              </span>
            </li>
          </ul>

          {event.theme ? (
            <p className="mt-4 text-body-lg break-words text-feature-muted-foreground">
              Tema:{" "}
              <span className="font-heading text-title-sm font-semibold text-feature-highlight">
                {event.theme}
              </span>
            </p>
          ) : null}

          <HeroActions
            clubId={clubId}
            event={event}
            ongoing={state.kind === "ongoing"}
            quiet={quiet}
          />
        </div>
      </div>
    </section>
  );
}

function HeroBadge({ state }: { state: HeroState }) {
  const highlighted = isHeroHighlighted(state);
  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center gap-2 rounded-full px-3.5 py-1 text-body-sm-tight font-bold",
        highlighted
          ? "bg-highlight text-highlight-foreground"
          : "border border-feature-border-strong bg-feature-hover text-feature-foreground",
      )}
    >
      {state.kind === "ongoing" ? (
        <span aria-hidden className="size-2 animate-pulse rounded-full bg-highlight-foreground" />
      ) : null}
      {heroStateLabel(state)}
    </span>
  );
}
