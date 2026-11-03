/**
 * How tokens.css and the theme script (src/lib/theme-prefs.ts) agree on the
 * theme (SPEC §13.2, D-171): the choice is data-theme on <html>, and without
 * a choice the CSS follows the device's dark mode. No imports: the generator
 * (css.ts) and the app both read it.
 */
export const THEME_ATTRIBUTE = "data-theme";
export const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";
