"use client";

import { useSyncExternalStore } from "react";

import {
  clampFontStep,
  DEFAULT_SONG_FONT_STEP,
  DEFAULT_SONG_VIEW,
  parseFontStep,
  parseSongView,
  SONG_FONT_STEP_KEY,
  SONG_SIZE_ATTRIBUTE,
  SONG_VIEW_ATTRIBUTE,
  SONG_VIEW_KEY,
  type SongView,
} from "@/lib/songbook-prefs";

/**
 * The reader's font step and view (src/lib/songbook-prefs.ts), read from and
 * written to the <html> data attributes the head bootstrap set before the
 * first paint. useSyncExternalStore: the server snapshot (and the hydration
 * render) is the default, so the controls never mismatch; the text itself is
 * sized by CSS from the attribute, so it never jumps. A write also goes to
 * localStorage (try/catch: private mode keeps it for this page only).
 */

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function write(attribute: string, key: string, value: string) {
  document.documentElement.setAttribute(attribute, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the attribute still applies until the next hard load.
  }
  for (const listener of listeners) listener();
}

const readFontStep = () =>
  parseFontStep(document.documentElement.getAttribute(SONG_SIZE_ATTRIBUTE));
const readView = () => parseSongView(document.documentElement.getAttribute(SONG_VIEW_ATTRIBUTE));

export function setSongFontStep(step: number) {
  write(SONG_SIZE_ATTRIBUTE, SONG_FONT_STEP_KEY, String(clampFontStep(step)));
}

export function setSongView(view: SongView) {
  write(SONG_VIEW_ATTRIBUTE, SONG_VIEW_KEY, view);
}

export function useSongFontStep(): number {
  return useSyncExternalStore(subscribe, readFontStep, () => DEFAULT_SONG_FONT_STEP);
}

export function useSongView(): SongView {
  return useSyncExternalStore(subscribe, readView, () => DEFAULT_SONG_VIEW);
}

const noopSubscribe = () => () => {};

/** False on the server and during hydration: the controls stay disabled until then (TG-020). */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
