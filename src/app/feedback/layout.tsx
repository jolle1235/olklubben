import { AppShell } from "@/components/features/app-shell";
import { SessionRefresh } from "@/components/features/auth/session-refresh";
import { FeedbackShell } from "@/components/features/feedback/feedback-shell";
import { getDisplayName } from "@/lib/format/display-name";
import { getUserClubs, requireUser } from "@/server/auth/session";

/**
 * Frame for the app-wide feedback pages (SPEC §9.9, D-147). Feedback has no
 * club, but its way in is Profil, so a user with clubs keeps the AppShell of
 * the club they were last in (User.lastActiveClubId while still a member,
 * else their first club), with the Profil tab active (nav-items: alsoActiveOn
 * "/feedback"). There is deliberately no main navigation item. A user without
 * clubs gets FeedbackShell (CenteredShell's look, "Tilbage", "Logget ind
 * som …").
 *
 * READ-ONLY (D-052, D-066): a Link prefetch renders this layout, so it never
 * writes – in particular it never remembers an active club; the feedback
 * pages never call requireClubPage. Every page calls requireUser() (or
 * requireFeedback) itself, because this layout is not re-rendered between
 * pages.
 *
 * Loading boundaries and real 404s (D-065, D-148): NO loading.tsx directly in
 * this folder. The list's loading.tsx sits in the (list) group, "Ny rapport"
 * has its own, a report has the guard layout [feedbackId]/layout.tsx
 * (requireFeedback → real 404) ABOVE (detail)/loading.tsx, and edit/ has none.
 */
export default async function FeedbackLayout({ children }: LayoutProps<"/feedback">) {
  const user = await requireUser();
  const clubs = await getUserClubs(user.id);
  const club = clubs.find((candidate) => candidate.id === user.lastActiveClubId) ?? clubs[0];

  if (!club) return <FeedbackShell email={user.email}>{children}</FeedbackShell>;

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
