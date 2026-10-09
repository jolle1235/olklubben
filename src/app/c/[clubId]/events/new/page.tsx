import type { Metadata } from "next";

import { EventForm } from "@/components/features/events/event-form";
import { overviewHref } from "@/lib/routes";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireClubPage } from "@/server/auth/session";
import { DEFAULT_EVENT_START_TIME, isDateKey } from "@/server/domain/events/time";
import { getSuggestedEventTitle } from "@/server/events/queries";

export const metadata: Metadata = { title: "Opret event" };

/**
 * "Opret event" (SPEC §9.2, §10.4). The title is suggested ("Ølsmagning #N",
 * D-064) and the start time is 18:30. `?date=YYYY-MM-DD` pre-fills the date,
 * e.g. from a day in the calendar; anything else is ignored.
 *
 * Never calls notFound() itself, so loading.tsx may sit next to it (TG-008).
 */
export default async function NewEventPage({
  params,
  searchParams,
}: PageProps<"/c/[clubId]/events/new">) {
  const { clubId } = await params;
  const { club } = await requireClubPage(clubId);
  const { date } = await searchParams;
  const title = await getSuggestedEventTitle(club.id);

  return (
    <>
      <PageHeader
        title="Opret event"
        description="Sæt dato, tid og sted. Resten kan I tale om over en øl."
      />
      <Card className="max-w-2xl">
        <CardContent>
          <EventForm
            clubId={club.id}
            cancelHref={overviewHref(club.id)}
            defaults={{
              title,
              date: typeof date === "string" && isDateKey(date) ? date : "",
              startTime: DEFAULT_EVENT_START_TIME,
              endTime: "",
              newPlaceName: "",
              theme: "",
              description: "",
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
