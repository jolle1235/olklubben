import Link from "next/link";
import { ChevronRightIcon, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type LinkRowProps = {
  href: string;
  icon: LucideIcon;
  title: React.ReactNode;
  subtitle: React.ReactNode;
  /** The frame: a card of its own, or a row in a list (SPEC §13.4). */
  className?: string;
};

/**
 * A big link row: the icon in a porthole on the frame colour, title,
 * subtitle and ›. The caller gives the frame through `className`.
 */
export function LinkRow({ href, icon: Icon, title, subtitle, className }: LinkRowProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group/row flex min-h-16 items-center gap-4 px-4 py-3 hover:bg-card-hover",
        className,
      )}
    >
      <span
        aria-hidden
        className="grid size-10 shrink-0 place-items-center rounded-full bg-frame text-highlight [&_svg]:size-5"
      >
        <Icon strokeWidth={2.25} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-heading text-body-lg-tight font-semibold text-primary-ink">
          {title}
        </span>
        <span className="block text-body-sm text-pretty text-muted-foreground">{subtitle}</span>
      </span>
      <ChevronRightIcon
        aria-hidden
        className="size-5 shrink-0 text-muted-foreground transition-transform group-hover/row:translate-x-0.5"
      />
    </Link>
  );
}
