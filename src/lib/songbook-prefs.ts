/**
 * The song reader's preferences (SPEC §9.6 "Læsevisning"): the font size and
 * the view (Tekst | Akkorder), remembered PER DEVICE in localStorage.
 *
 * They live as data attributes on <html> (data-song-size, data-song-view), so
 * CSS (the "Sangbog" block in globals.css) shows the right size and view on
 * the server's HTML. SONGBOOK_PREFS_BOOTSTRAP sets them from localStorage in
 * the root layout's <head>, before the first paint: the text never jumps on a
 * hard load. The hooks in components/features/songs/use-songbook-prefs.ts
 * read and write the same attributes.
 *
 * localStorage holds only these two values, never song text. Every access is
 * wrapped in try/catch (private mode, blocked storage): the defaults apply.
 *
 * Pure module: client-safe, no React.
 */

/** The 7 font steps, 16–32 px. */
export const SONG_FONT_SIZES_REM = [1, 1.125, 1.25, 1.375, 1.5625, 1.75, 2] as const;
/** 1.25rem (20 px). */
export const DEFAULT_SONG_FONT_STEP = 2;
export const MAX_SONG_FONT_STEP = SONG_FONT_SIZES_REM.length - 1;

export const SONG_VIEWS = ["lyrics", "chords"] as const;
export type SongView = (typeof SONG_VIEWS)[number];
export const DEFAULT_SONG_VIEW: SongView = "lyrics";

export const SONG_FONT_STEP_KEY = "olklubben.songbook.fontStep";
export const SONG_VIEW_KEY = "olklubben.songbook.view";

/** The <html> attributes (also what the CSS keys on). */
export const SONG_SIZE_ATTRIBUTE = "data-song-size";
export const SONG_VIEW_ATTRIBUTE = "data-song-view";

/** A stored or attribute value → a valid step; anything else gives the default. */
export function parseFontStep(value: string | null | undefined): number {
  if (typeof value !== "string" || !/^\d$/.test(value)) return DEFAULT_SONG_FONT_STEP;
  const step = Number(value);
  return step <= MAX_SONG_FONT_STEP ? step : DEFAULT_SONG_FONT_STEP;
}

/** A stored or attribute value → a valid view; anything else gives the default. */
export function parseSongView(value: string | null | undefined): SongView {
  return value === "chords" || value === "lyrics" ? value : DEFAULT_SONG_VIEW;
}

/** Clamps a step to 0 … MAX_SONG_FONT_STEP. */
export function clampFontStep(step: number): number {
  return Math.min(MAX_SONG_FONT_STEP, Math.max(0, Math.round(step)));
}

/**
 * The constant script in the root layout's <head> (the only
 * dangerouslySetInnerHTML of the songbook). Sets the attributes only for valid
 * stored values; otherwise the CSS defaults apply. Built from the constants
 * above, so it cannot drift from parseFontStep/parseSongView.
 */
export const SONGBOOK_PREFS_BOOTSTRAP = `(function(){try{var d=document.documentElement,s=localStorage.getItem(${JSON.stringify(
  SONG_FONT_STEP_KEY,
)}),v=localStorage.getItem(${JSON.stringify(SONG_VIEW_KEY)});if(s!==null&&/^[0-${MAX_SONG_FONT_STEP}]$/.test(s))d.setAttribute(${JSON.stringify(
  SONG_SIZE_ATTRIBUTE,
)},s);if(v==="lyrics"||v==="chords")d.setAttribute(${JSON.stringify(SONG_VIEW_ATTRIBUTE)},v)}catch(e){}})();`;
