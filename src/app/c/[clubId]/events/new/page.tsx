import type { Metadata } from "next";

import { EventForm } from "@/components/features/events/event-form";
import {
  hostFallbackFor,
  toHostChoices,
  toPlaceChoices,
} from "@/components/features/events/event-form-state";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { overviewHref } from "@/lib/routes";
import { firstParam } from "@/lib/search-params";
import { requireClubPage } from "@/server/auth/session";
import { listMemberOptions } from "@/server/clubs/queries";
import { DEFAULT_EVENT_START_TIME, isDateKey } from "@/server/domain/events/time";
import { getSuggestedEventTitle } from "@/server/events/queries";
import { listPlaceOptions } from "@/server/places/queries";

export const metadata: Metadata = { title: "Opret event" };

/**
 * "Opret event" (SPEC §9.2, §10.4). The title is suggested ("Ølsmagning #N",
 * D-064) and the start time is 18:30. `?date=YYYY-MM-DD` pre-fills the date
 * (a day in the calendar); `?placeId=` pre-selects one of the club's ACTIVE
 * places ("Opret event her" on a place, D-108). Anything else is ignored.
 *
 * The PlaceSelector offers the club's active places, last used first, and
 * "＋ Nyt sted"; the HostsPicker its members (D-098, D-099).
 *
 * Never calls notFound() itself, so loading.tsx may sit next to it (TG-008).
 */
export default async function NewEventPage({
  params,
  searchParams,
}: PageProps<"/c/[clubId]/events/new">) {
  const { clubId } = await params;
  const { user, club } = await requireClubPage(clubId);
  const { date, placeId } = await searchParams;
  const dateKey = firstParam(date);
  const [title, places, members] = await Promise.all([
    getSuggestedEventTitle(club.id),
    listPlaceOptions(club.id),
    listMemberOptions(club.id),
  ]);

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
            places={toPlaceChoices(places)}
            hostChoices={toHostChoices(members)}
            currentUserId={user.id}
            hostFallback={hostFallbackFor({
              user,
              memberIds: new Set(members.map((member) => member.id)),
            })}
            prefillPlaceId={firstParam(placeId) ?? null}
            defaults={{
              title,
              date: dateKey && isDateKey(dateKey) ? dateKey : "",
              startTime: DEFAULT_EVENT_START_TIME,
              endTime: "",
              theme: "",
              description: "",
              placeId: null,
              hostIds: null,
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
