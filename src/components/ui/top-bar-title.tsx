"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

import { isSubpage } from "@/lib/nav-history";

export const TOP_BAR_TITLE_SLOT_ID = "top-bar-title";

const subscribe = () => () => {};
const getSlot = () => document.getElementById(TOP_BAR_TITLE_SLOT_ID);
const getServerSlot = () => null;

/**
 * Lives in ui/ so PageHeader can use it; TopBar (app-shell) imports the slot id.
 *
 * The page's name in the mobile top bar, next to "‹ Tilbage" (D-182). Only on
 * subpages: on a main page the club switcher has the bar. Plain text, since the
 * slot is aria-hidden (the page's own h1 says the same).
 */
export function TopBarTitle({ children }: { children: string }) {
  const slot = useSyncExternalStore(subscribe, getSlot, getServerSlot);
  const pathname = usePathname();
  return slot && isSubpage(pathname) ? createPortal(children, slot) : null;
}
