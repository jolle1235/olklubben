"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { getNavItems, isNavItemActive } from "./nav-items";

export type BottomNavProps = { clubId: string; className?: string };

/**
 * Mobile navigation (< md): fixed to the bottom, five items with icon + label,
 * targets ≥ 44 px, padded for the iPhone home indicator (SPEC §8.1).
 * AppShell pads <main> so nothing hides behind it.
 */
export function BottomNav({ clubId, className }: BottomNavProps) {
  const pathname = usePathname();
  const items = getNavItems(clubId);

  return (
    <nav
      aria-label="Hovednavigation"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-white/10 on-olive pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_30px_-18px_rgb(45_47_35/0.7)] md:hidden",
        className,
      )}
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {items.map((item) => {
          const active = isNavItemActive(pathname, item);
          const Icon = item.icon;
          return (
            <li key={item.key} className="flex">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-1 flex-col items-center justify-center gap-1 px-1 pt-2 pb-1.5 text-[0.8125rem] leading-none font-semibold transition-colors",
                  active ? "text-cream" : "text-on-dark-muted hover:text-cream",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid size-8 place-items-center rounded-full transition-colors [&_svg]:size-[1.2rem]",
                    active && "porthole bg-amber text-olive-deep",
                  )}
                >
                  <Icon strokeWidth={2.25} />
                </span>
                <span className="mt-0.5">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
