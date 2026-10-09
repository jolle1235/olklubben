import Link from "next/link";

import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";

export type CenteredShellProps = {
  children: React.ReactNode;
  /** Rendered as the page's <h1> at the top of the card. */
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Under the card, e.g. "Har du ikke en konto? Opret en". */
  footer?: React.ReactNode;
  /** Where the logo links to. Default "/". */
  logoHref?: string;
  className?: string;
};

/**
 * Layout for logged-out and onboarding pages: an olive band with the logo
 * and a wave edge, and a paper card that floats on it. Mobile first.
 */
export function CenteredShell({
  children,
  title,
  subtitle,
  footer,
  logoHref = "/",
  className,
}: CenteredShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="relative overflow-hidden on-olive pt-[calc(env(safe-area-inset-top)+2.25rem)] pb-24 sm:pb-28">
        <div className="flex justify-center px-4">
          <Link href={logoHref} className="rounded-lg">
            <Logo tone="cream" size="lg" />
          </Link>
        </div>
        {/* Wave edge between the olive band and the cream page. */}
        <svg
          aria-hidden
          viewBox="0 0 1440 48"
          preserveAspectRatio="none"
          className="absolute -bottom-px left-1/2 h-10 w-[max(100%,36rem)] -translate-x-1/2 text-background sm:h-12"
        >
          <path
            fill="currentColor"
            d="M0 26c120-18 240-18 360 0s240 18 360 0 240-18 360 0 240 18 360 0v22H0Z"
          />
        </svg>
      </div>

      <main className="-mt-20 flex flex-1 flex-col items-center px-4 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] sm:-mt-24">
        <div
          className={cn(
            "relative w-full max-w-md rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-[0_24px_50px_-28px_rgb(45_47_35/0.55)] sm:p-8",
            className,
          )}
        >
          {title || subtitle ? (
            <header className="mb-6">
              {title ? (
                <h1 className="text-[1.85rem] leading-tight font-bold tracking-tight text-olive">
                  {title}
                </h1>
              ) : null}
              {subtitle ? (
                <p className="mt-2 text-[1.05rem] text-muted-foreground">{subtitle}</p>
              ) : null}
            </header>
          ) : null}
          {children}
        </div>
        {footer ? (
          <div className="mt-6 w-full max-w-md text-center text-[0.95rem] text-muted-foreground">
            {footer}
          </div>
        ) : null}
      </main>
    </div>
  );
}
