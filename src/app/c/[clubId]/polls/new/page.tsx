import type { Metadata } from "next";

import { PollForm } from "@/components/features/polls/poll-form";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireClubPage } from "@/server/auth/session";
import { utcToZonedParts } from "@/server/domain/events/time";
import { DEFAULT_POLL_START_TIME } from "@/server/domain/polls/options";
import { suggestDeadline, suggestPollDates } from "@/server/domain/polls/schedule";
import { listPlaceOptions } from "@/server/places/queries";
import { getSuggestedPollTitle, listRecentEventStarts } from "@/server/polls/queries";

export const metadata: Metadata = { title: "Planlæg ølsmagning" };

/**
 * "Planlæg ølsmagning" (SPEC §9.7.1, D-135): a 30-second form. The title is
 * suggested ("Ølsmagning #N", counting events and active polls, D-137), three
 * dates on the club's usual weekday (fallback Saturday, the first at least
 * 7 days ahead) at 18:30, and a deadline two days before the first date at
 * 20:00 (clamped). The places are the club's active ones, last used first.
 *
 * Never calls notFound() itself, so loading.tsx may sit next to it (TG-008).
 */
export default async function NewPollPage({ params }: PageProps<"/c/[clubId]/polls/new">) {
  const { clubId } = await params;
  const { club } = await requireClubPage(clubId);
  const now = new Date();
  const today = utcToZonedParts(now).date;
  const [title, places, pastStarts] = await Promise.all([
    getSuggestedPollTitle(club.id),
    listPlaceOptions(club.id),
    listRecentEventStarts(club.id),
  ]);
  const dates = suggestPollDates({ today, pastStarts });
  const [firstDate] = dates;
  const deadline = firstDate
    ? suggestDeadline({ firstDate, startTime: DEFAULT_POLL_START_TIME, now })
    : null;

  return (
    <>
      <PageHeader
        title="Planlæg ølsmagning"
        description="Foreslå datoer og steder. Klubben stemmer, og vinderen bliver til et event af sig selv."
      />
      <Card className="max-w-2xl">
        <CardContent>
          <PollForm
            clubId={club.id}
            places={places}
            defaults={{ title, dates, startTime: DEFAULT_POLL_START_TIME, deadline }}
            today={today}
          />
        </CardContent>
      </Card>
    </>
  );
}
