import { BottomNav } from "./bottom-nav";
import type { ClubSummary } from "./club-switcher";
import { Sidebar, type ShellUser } from "./sidebar";
import { TopBar } from "./top-bar";

export type AppShellProps = {
  club: ClubSummary;
  clubs: ClubSummary[];
  user: ShellUser;
  children: React.ReactNode;
};

/**
 * Frame for every club page (/c/[clubId]/…). Mobile: olive top bar with the club
 * name + fixed bottom navigation. Desktop (md+): olive sidebar on the left.
 * Server Component; the interactive parts are client components.
 */
export function AppShell({ club, clubs, user, children }: AppShellProps) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[17rem_minmax(0,1fr)] md:bg-[linear-gradient(to_right,var(--olive)_17rem,transparent_17rem)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-paper focus:px-4 focus:py-3 focus:font-semibold focus:text-olive"
      >
        Spring til indhold
      </a>

      <Sidebar club={club} clubs={clubs} user={user} />

      <div className="flex min-h-dvh min-w-0 flex-col">
        <TopBar club={club} clubs={clubs} />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 px-4 pt-6 pb-[calc(6.5rem+env(safe-area-inset-bottom))] outline-none sm:px-6 md:px-10 md:pt-10 md:pb-16"
        >
          <div className="mx-auto w-full max-w-4xl">{children}</div>
        </main>
      </div>

      <BottomNav clubId={club.id} />
    </div>
  );
}
