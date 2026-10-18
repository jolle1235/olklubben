import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { SignedInFooter } from "@/components/features/profile/signed-in-footer";

export type FeedbackShellProps = {
  /** The logged-in user's email, for "Logget ind som …". */
  email: string;
  children: React.ReactNode;
};

/**
 * Frame for /feedback for a user WITHOUT clubs (D-147): there is no club for
 * the AppShell, so the pages get CenteredShell's look instead (the olive band
 * with the logo linking to "/" and the wave edge) and a wider content column
 * (max-w-2xl) for the list and the forms, "← Tilbage" to "/" (which routes to
 * onboarding) and "Logget ind som … · Log ud" at the bottom, which also slides
 * the session forward (SessionRefresh). Server Component.
 */
export function FeedbackShell({ email, children }: FeedbackShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-paper focus:px-4 focus:py-3 focus:font-semibold focus:text-olive"
      >
        Spring til indhold
      </a>
      <div className="relative overflow-hidden on-olive pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-12">
        <div className="mx-auto flex w-full max-w-2xl px-4">
          <Link href="/" className="rounded-lg">
            <Logo tone="cream" />
          </Link>
        </div>
        {/* Wave edge between the olive band and the cream page (as CenteredShell). */}
        <svg
          aria-hidden
          viewBox="0 0 1440 48"
          preserveAspectRatio="none"
          className="absolute -bottom-px left-1/2 h-8 w-[max(100%,36rem)] -translate-x-1/2 text-background sm:h-10"
        >
          <path
            fill="currentColor"
            d="M0 26c120-18 240-18 360 0s240 18 360 0 240-18 360 0 240 18 360 0v22H0Z"
          />
        </svg>
      </div>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-2xl flex-1 px-4 pt-4 pb-10 outline-none"
      >
        <Link
          href="/"
          className="mb-3 -ml-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 font-semibold text-olive underline-offset-4 hover:underline"
        >
          <ArrowLeftIcon aria-hidden className="size-4" />
          Tilbage
        </Link>
        {children}
      </main>

      <footer className="px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] text-center text-[0.95rem] text-muted-foreground">
        <SignedInFooter email={email} showFeedbackLink={false} />
      </footer>
    </div>
  );
}
