import { AnchorIcon, ExternalLinkIcon, MapPinIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { BigDate } from "@/components/ui/big-date";
import { Button } from "@/components/ui/button";
import { RopeDivider } from "@/components/ui/rope-divider";
import { formatLongDate, formatTime, toDateKey } from "@/lib/format/date";
import { mapsSearchUrl } from "@/lib/routes";
import { heroState, heroStateLabel, isHeroHighlighted } from "@/server/domain/events/status";

export type EventInvitationProps = {
  event: {
    title: string;
    theme: string | null;
    locationText: string;
    startsAt: Date;
    endsAt: Date | null;
  };
  /** "Oprettet af …" (getDisplayName of the creator). */
  creatorName: string;
  /** The request's time, for the status badge and the year in the date. */
  now: Date;
};

/**
 * The top of the event page, "som en invitation, ikke en formular" (SPEC
 * §9.2): anchor, status, title (the page's h1), theme, the big date, time,
 * place with "Åbn i kort", and who created it. Server Component.
 */
export function EventInvitation({ event, creatorName, now }: EventInvitationProps) {
  const state = heroState(event, now);
  const mapsUrl = mapsSearchUrl(event.locationText);

  return (
    <article className="rounded-3xl border border-border bg-paper px-5 pt-8 pb-6 text-center shadow-[0_18px_40px_-30px_rgb(65_68_55/0.6)] sm:px-10 sm:pt-10">
      <div
        aria-hidden
        className="mx-auto mb-5 grid size-12 place-items-center porthole rounded-full bg-harbor text-amber [&_svg]:size-6"
      >
        <AnchorIcon />
      </div>

      <Badge variant={isHeroHighlighted(state) ? "amber" : "info"} className="mb-3">
        {heroStateLabel(state)}
      </Badge>
      <h1 className="text-[2.25rem] leading-[1.05] font-bold tracking-tight break-words hyphens-auto text-olive md:text-[3rem]">
        {event.title}
      </h1>
      {event.theme ? (
        <p className="mx-auto mt-4 w-fit max-w-full rounded-2xl border border-amber/60 bg-amber-tint px-4 py-1.5 text-[1.05rem] break-words hyphens-auto text-ink">
          <span className="font-semibold">Tema:</span> {event.theme}
        </p>
      ) : null}

      <RopeDivider className="my-7" />

      {/* Decorative: the sentence below says the same for screen readers. */}
      <div aria-hidden className="text-olive">
        <BigDate date={event.startsAt} size="lg" className="items-center" />
      </div>
      <p className="mt-5 text-xl font-semibold text-ink first-letter:uppercase">
        <time dateTime={toDateKey(event.startsAt)}>{formatLongDate(event.startsAt, now)}</time>
      </p>
      <p className="mt-1 text-xl text-ink tabular-nums">
        <time dateTime={event.startsAt.toISOString()}>{formatTime(event.startsAt)}</time>
        {event.endsAt ? (
          <>
            <span aria-hidden>–</span>
            <span className="sr-only"> til </span>
            <time dateTime={event.endsAt.toISOString()}>{formatTime(event.endsAt)}</time>
          </>
        ) : null}
      </p>

      <RopeDivider variant="wave" className="my-7" />

      <p className="flex items-start justify-center gap-2 text-xl font-semibold text-ink">
        <MapPinIcon aria-hidden className="mt-1 size-5 shrink-0 text-olive" />
        <span className="sr-only">Sted: </span>
        <span className="min-w-0 break-words hyphens-auto">{event.locationText}</span>
      </p>
      {mapsUrl ? (
        <Button asChild variant="outline" className="mt-4">
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
            Åbn i kort
            <ExternalLinkIcon aria-hidden />
            <span className="sr-only">(åbner i en ny fane)</span>
          </a>
        </Button>
      ) : null}

      <p className="mt-7 border-t border-dashed border-border pt-4 text-[0.95rem] break-words text-muted-foreground">
        Oprettet af <span className="font-semibold text-ink">{creatorName}</span>
      </p>
    </article>
  );
}
