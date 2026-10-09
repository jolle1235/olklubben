import { notFound } from "next/navigation";

import { requireMembership } from "@/server/auth/session";

/**
 * Any unknown path below a club (e.g. /c/<id>/places before round 3, or an old
 * link). A member gets the club's own 404 inside the AppShell
 * (c/[clubId]/not-found.tsx); a non-member gets the root 404 from the layout
 * and learns nothing about the club (§4.4, D-012).
 *
 * The real pages (club, profile, calendar, beers, songs, events …) take
 * precedence over this catch-all. requireMembership(), not requireClubPage():
 * an unknown URL must not change the active club.
 *
 * No loading.tsx is above this route, so members get a real HTTP 404 too
 * (TG-008; see c/[clubId]/layout.tsx).
 */
export default async function UnknownClubRoute({ params }: PageProps<"/c/[clubId]/[...rest]">) {
  const { clubId } = await params;
  await requireMembership(clubId);
  notFound();
}
