"use client";

import { createHtmlPref, useHtmlPref } from "@/hooks/use-html-pref";
import {
  clampFontStep,
  parseFontStep,
  parseSongView,
  SONG_FONT_STEP_KEY,
  SONG_SIZE_ATTRIBUTE,
  SONG_VIEW_ATTRIBUTE,
  SONG_VIEW_KEY,
  type SongView,
} from "@/lib/songbook-prefs";

const fontStep = createHtmlPref({
  attribute: SONG_SIZE_ATTRIBUTE,
  storageKey: SONG_FONT_STEP_KEY,
  parse: parseFontStep,
});

const view = createHtmlPref({
  attribute: SONG_VIEW_ATTRIBUTE,
  storageKey: SONG_VIEW_KEY,
  parse: parseSongView,
});

export function setSongFontStep(step: number) {
  fontStep.set(clampFontStep(step));
}

export function setSongView(next: SongView) {
  view.set(next);
}

export function useSongFontStep(): number | null {
  return useHtmlPref(fontStep);
}

export function useSongView(): SongView | null {
  return useHtmlPref(view);
}
