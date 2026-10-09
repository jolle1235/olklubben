"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

export const TOP_BAR_ACTION_SLOT_ID = "top-bar-action";

const subscribe = () => () => {};
const getSlot = () => document.getElementById(TOP_BAR_ACTION_SLOT_ID);
const getServerSlot = () => null;

/**
 * Puts a page's primary action in the mobile top bar, to the right of the club
 * name (SPEC §8.1, fx "+"). Render it anywhere in a page inside AppShell. The
 * top bar is hidden from md and up, so also show the action in the page (e.g. in
 * PageHeader with `className="hidden md:inline-flex"`).
 *
 * Use an olive-friendly button: <Button size="icon" variant="brass" aria-label="Opret event">.
 */
export function TopBarAction({ children }: { children: React.ReactNode }) {
  const slot = useSyncExternalStore(subscribe, getSlot, getServerSlot);
  return slot ? createPortal(children, slot) : null;
}
