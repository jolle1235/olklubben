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
   * Another card on the screen holds the primary action (the invitation's
   * "Del" in a one-member club, D-057), so the hero's own buttons are quiet.
   */
  quiet?: boolean;
};

/**
 * The next event, big and clear (SPEC §3.2, §9.1): "NÆSTE ØLSMAGNING" with a
 * relative badge, the big date, title, weekday · time, place, theme and
 * [Se event]. While the event is on, the shortcuts [Tilføj øl] (pre-filled
 * with the event) and [Sangbog] come first. A harbor-blue card (the secondary
 * colour), so it stands apart from the olive app chrome and amber is allowed
 * (§13.2); "I aften! 🍻" and "I gang nu" light up in amber.
 */
export function NextEventHero({ clubId, event, now, quiet = false }: NextEventHeroProps) {
  const state = heroState(event, now);
  const highlighted = isHeroHighlighted(state);

  return (
    <section
      aria-labelledby="next-event-label"
      className={cn(
        "relative isolate overflow-hidden rounded-2xl on-harbor px-5 pt-5 pb-6 shadow-[0_22px_44px_-26px_rgb(45_47_35/0.95)] sm:px-7 md:px-10 md:pt-8 md:pb-10",
        highlighted && "ring-[3px] ring-amber ring-offset-2 ring-offset-cream",
      )}
    >
      <AnchorIcon
        aria-hidden
        strokeWidth={1.1}
        className="pointer-events-none absolute -right-12 -bottom-14 -z-10 size-64 text-harbor-soft md:-right-8 md:size-80"
      />

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p
          id="next-event-label"
          className="text-[0.8rem] font-bold tracking-[0.2em] text-on-dark-muted uppercase"
        >
          Næste ølsmagning
        </p>
        <HeroBadge state={state} />
      </div>

      <div className="mt-5 grid gap-5 md:mt-7 md:grid-cols-[auto_minmax(0,1fr)] md:items-center md:gap-0">
        <BigDate date={event.startsAt} size="lg" className="text-cream md:pr-10" />

        <div className="min-w-0 md:border-l md:border-white/15 md:pl-10">
          <h2 className="text-[2rem] leading-[1.1] font-bold break-words hyphens-auto text-cream md:text-[2.5rem]">
            {event.title}
          </h2>

          <ul className="mt-3 flex flex-col gap-1.5 text-lg text-cream">
            <li className="flex items-center gap-2.5">
              <ClockIcon aria-hidden className="size-5 shrink-0 text-amber" />
              {eventWeekdayAndTime(event)}
            </li>
            <li className="flex items-start gap-2.5">
              <MapPinIcon aria-hidden className="mt-1 size-5 shrink-0 text-amber" />
              <span className="min-w-0 break-words">
                <span className="sr-only">Sted: </span>
                {event.locationText}
              </span>
            </li>
          </ul>

          {event.theme ? (
            <p className="mt-4 text-lg break-words text-on-dark-muted">
              Tema:{" "}
              <span className="font-heading text-[1.35rem] leading-snug font-semibold text-amber-light">
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
        "inline-flex min-h-8 items-center gap-2 rounded-full px-3.5 py-1 text-[0.95rem] leading-tight font-bold",
        highlighted
          ? "bg-amber text-ink"
          : "border border-on-dark-muted/40 bg-harbor-soft text-cream",
      )}
    >
      {state.kind === "ongoing" ? (
        <span aria-hidden className="size-2 animate-pulse rounded-full bg-ink" />
      ) : null}
      {heroStateLabel(state)}
    </span>
  );
}
