import Link from "next/link";
import { ChevronRightIcon, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type LinkRowProps = {
  href: string;
  /** The icon in a porthole on the frame colour; or give `leading` instead. */
  icon?: LucideIcon;
  /** Something else first, e.g. an avatar or a club badge (Indstillinger, D-183). */
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** What closes the row; a › by default. */
  trailing?: React.ReactNode;
  /** The frame: a card of its own, or a row in a list (SPEC §13.4). */
  className?: string;
  "aria-current"?: "page";
};

/**
 * A big link row: an icon (or `leading`), title, subtitle and ›. The caller
 * gives the frame through `className`.
 */
export function LinkRow({
  href,
  icon: Icon,
  leading,
  title,
  subtitle,
  trailing,
  className,
  "aria-current": ariaCurrent,
}: LinkRowProps) {
  return (
    <Link
      href={href}
      aria-current={ariaCurrent}
      className={cn(
        "group/row flex min-h-16 items-center gap-4 px-4 py-3 hover:bg-card-hover",
        className,
      )}
    >
      {Icon ? (
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-full bg-frame text-highlight [&_svg]:size-5"
        >
          <Icon strokeWidth={2.25} />
        </span>
      ) : (
        leading
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-heading text-list-title-tight font-semibold break-words hyphens-auto text-primary-ink">
          {title}
        </span>
        {subtitle ? (
          <span className="block text-body-sm text-pretty text-muted-foreground">{subtitle}</span>
        ) : null}
      </span>
      {trailing ?? (
        <ChevronRightIcon
          aria-hidden
          className="size-5 shrink-0 text-muted-foreground transition-transform group-hover/row:translate-x-0.5"
        />
      )}
    </Link>
  );
}
