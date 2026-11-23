"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

export const TOP_BAR_ACTION_SLOT_ID = "top-bar-action";

const subscribe = () => () => {};
const getSlot = () => document.getElementById(TOP_BAR_ACTION_SLOT_ID);
const getServerSlot = () => null;

/**
 * Puts a page tool at the right of the mobile top bar, on subpages
 * (SPEC §8.1), e.g. the song reader's text size. Not for "+"/add actions:
 * those sit in the page, under the title (PageHeader action, D-179). Render
 * it anywhere in a page inside AppShell; the top bar is hidden from md up.
 *
 * Use buttons that work on the frame (variant "ghost" or "highlight").
 */
export function TopBarAction({ children }: { children: React.ReactNode }) {
  const slot = useSyncExternalStore(subscribe, getSlot, getServerSlot);
  return slot ? createPortal(children, slot) : null;
}
