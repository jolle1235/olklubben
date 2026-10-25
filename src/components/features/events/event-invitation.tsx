import Link from "next/link";
import { AnchorIcon, ExternalLinkIcon, MapPinIcon, PlusIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { BigDate } from "@/components/ui/big-date";
import { Button } from "@/components/ui/button";
import { SectionDivider } from "@/components/ui/section-divider";
import { formatLongDate, formatTime, toDateKey } from "@/lib/format/date";
import { editPlaceHref, mapsSearchUrl, placeHref } from "@/lib/routes";
import { heroState, heroStateLabel, isHeroHighlighted } from "@/server/domain/events/status";

import { EventHosts, type EventHostView } from "./event-hosts";
import { EventPollNote } from "./event-poll-note";

export type EventInvitationProps = {
  clubId: string;
  event: {
    title: string;
    theme: string | null;
    place: { id: string; name: string; address: string | null; archived: boolean };
    startsAt: Date;
    endsAt: Date | null;
  };
  /** "Vært: …" / "Værter: …", sorted by display name. */
  hosts: readonly EventHostView[];
  /** "Oprettet af …" (getDisplayName of the creator). */
  creatorName: string;
  /** The request's time, for the status badge and the year in the date. */
  now: Date;
  /** Set when a poll created the event: "Valgt ved afstemning 🗳" links to it (D-137). */
  pollId?: string | null;
};

/**
 * The top of the event page, "som en invitation, ikke en formular" (SPEC
 * §9.2): anchor, status, title (the page's h1), theme, the big date, time,
 * the place (a link to it, "Arkiveret" when archived, its address), "Åbn i
 * kort" – only with an address (D-101), else a small "Tilføj adresse" to the
 * place's edit page – and the hosts and who created it, plus "Valgt ved
 * afstemning 🗳" when a poll chose it (round 4). Server Component.
 */
export function EventInvitation({
  clubId,
  event,
  hosts,
  creatorName,
  now,
  pollId = null,
}: EventInvitationProps) {
  const state = heroState(event, now);
  const { place } = event;
  const mapsUrl = place.address ? mapsSearchUrl(place.address) : null;

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

      <SectionDivider className="my-7" />

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

      <SectionDivider className="my-7" />

      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xl font-semibold text-ink">
        <MapPinIcon aria-hidden className="size-5 shrink-0 text-olive" />
        <span className="sr-only">Sted: </span>
        <Link
          href={placeHref(clubId, place.id)}
          className="inline-flex min-h-11 min-w-0 items-center break-words hyphens-auto underline decoration-amber decoration-2 underline-offset-[5px] hover:decoration-olive"
        >
          {place.name}
        </Link>
        {place.archived ? <Badge variant="outline">Arkiveret</Badge> : null}
      </p>
      {place.address ? (
        <p className="mx-auto max-w-[40ch] text-[1.05rem] break-words hyphens-auto text-slate">
          {place.address}
        </p>
      ) : null}
      {mapsUrl ? (
        <Button asChild variant="outline" className="mt-4">
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
            Åbn i kort
            <ExternalLinkIcon aria-hidden />
            <span className="sr-only">(åbner i en ny fane)</span>
          </a>
        </Button>
      ) : (
        <Link
          href={editPlaceHref(clubId, place.id)}
          className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-[0.95rem] font-semibold text-olive underline decoration-2 underline-offset-4 hover:decoration-amber"
        >
          <PlusIcon aria-hidden className="size-4" />
          Tilføj adresse
        </Link>
      )}

      <div className="mt-7 grid grid-cols-1 gap-2 border-t border-dashed border-border pt-4">
        <EventHosts hosts={hosts} />
        <p className="text-[0.95rem] break-words text-muted-foreground">
          Oprettet af <span className="font-semibold text-ink">{creatorName}</span>
        </p>
        {pollId ? <EventPollNote clubId={clubId} pollId={pollId} /> : null}
      </div>
    </article>
  );
}
