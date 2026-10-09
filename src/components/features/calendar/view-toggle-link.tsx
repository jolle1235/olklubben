"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import type { CalendarView } from "./calendar-params";

/**
 * The view the user just switched to with the toggle. Switching renders the
 * other view's toggle (a new element), so focus would drop to <body>; the new
 * view's link takes it back once it is on screen. Module state: one toggle
 * switch at a time, in one tab.
 */
let pendingFocusView: CalendarView | null = null;

export type ViewToggleLinkProps = {
  view: CalendarView;
  /** This link's view is the one on screen (aria-current="page"). */
  active: boolean;
  href: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * One link of "Liste | Måned" (<CalendarViewToggle />). A plain ?view= link,
 * so it works without JavaScript (D-078); with JavaScript, keyboard focus
 * follows the switch to the new view's link (progressive enhancement).
 */
export function ViewToggleLink({ view, active, href, className, children }: ViewToggleLinkProps) {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const element = ref.current;
    // getClientRects() is empty for the display: none copy of the responsive
    // pair (no ?view), so only the visible link takes focus.
    if (!active || pendingFocusView !== view || !element) return;
    if (element.getClientRects().length === 0) return;
    pendingFocusView = null;
    element.focus();
  }, [active, view]);

  return (
    <Link
      ref={ref}
      href={href}
      aria-current={active ? "page" : undefined}
      scroll={false}
      className={className}
      onNavigate={() => {
        // The active link re-renders the same view: nothing to restore.
        if (!active) pendingFocusView = view;
      }}
    >
      {children}
    </Link>
  );
}
