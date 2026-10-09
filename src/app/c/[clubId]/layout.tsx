import { AppShell } from "@/components/features/app-shell";
import { SessionRefresh } from "@/components/features/auth/session-refresh";
import { getDisplayName } from "@/lib/format/display-name";
import { getUserClubs, requireMembership } from "@/server/auth/session";

/**
 * Frame for every club page (SPEC §3.1, §8.1). Not a member, unknown club or
 * malformed id → 404 (requireMembership, E22).
 *
 * Next.js does not re-render this layout when navigating between pages of the
 * same club, so every page calls requireClubPage() itself (E16, D-036). The
 * page, not this layout, remembers the active club (§10.3): a Link prefetch
 * renders this layout (it sits above loading.tsx), so writing here would switch
 * the active club whenever a link to another club scrolls into view. No
 * database writes in layouts.
 *
 * <SessionRefresh /> slides the session forward once a day (D-030). The
 * `?toast=` flash messages are shown by <FlashToast /> in the root layout
 * (D-104). The sidebar shows the user's display name (nickname ?? name, D-105).
 *
 * Loading boundaries and real 404s (TG-008): a response streams (HTTP 200) as
 * soon as a loading.tsx fallback renders, so a notFound() below a loading.tsx
 * becomes a "soft" 404. Therefore there is NO loading.tsx directly in this
 * folder. Rules for pages under c/[clubId]:
 *
 *   * A page that never calls notFound() itself (lists, forms for new things)
 *     may have a loading.tsx next to it. When its folder has sub-routes, put
 *     the page and its loading.tsx in a route group so the boundary does not
 *     wrap them: (overview)/, beers/(catalog)/, places/(list)/, club/(members)/.
 *   * A resource (events/[eventId], beers/[beerId], places/[placeId]) has a
 *     guard layout.tsx that checks the resource (requireEvent/requireBeer/
 *     requirePlace → real 404) ABOVE its loading.tsx, which sits in a (detail)
 *     group next to the page.
 *   * A page that 404s on its own check (e.g. edit/: only creator, host or
 *     admin; club/edit: only admins) has no loading.tsx above it; neither has
 *     the [...rest] catch-all.
 */
export default async function ClubLayout({ children, params }: LayoutProps<"/c/[clubId]">) {
  const { clubId } = await params;
  const { user, club } = await requireMembership(clubId);

  const clubs = await getUserClubs(user.id);

  return (
    <AppShell
      club={{ id: club.id, name: club.name }}
      clubs={clubs.map(({ id, name }) => ({ id, name }))}
      user={{ name: getDisplayName(user), email: user.email, image: user.image }}
    >
      <SessionRefresh />
      {children}
    </AppShell>
  );
}
