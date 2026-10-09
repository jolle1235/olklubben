/**
 * Danish lists in running text: "Værter: Mads og Anders" (SPEC §9.2).
 *
 * Built by hand instead of Intl.ListFormat, so the server and the browser
 * always render the same text (no hydration mismatch between ICU versions).
 *
 * Client-safe: no server-only imports.
 */

/** "" · "Mads" · "Mads og Anders" · "Mads, Anders og Bo". */
export function formatDanishList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} og ${items.at(-1)}`;
}
