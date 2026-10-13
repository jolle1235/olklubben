"use client";

import { SONGBOOK_PREFS_BOOTSTRAP } from "@/lib/songbook-prefs";

/**
 * The songbook reader's font size and view on <html> before the first paint
 * (src/lib/songbook-prefs.ts). A constant string: the songbook's only
 * dangerouslySetInnerHTML.
 *
 * In the server HTML it is a normal inline script, so the browser runs it
 * while parsing <head>. React never runs a script it creates itself, and it
 * warns when it does (the client render of a 404 rebuilds the document,
 * F-071). On the client the element is therefore a data block
 * (type="text/plain"): hydration keeps the server's element as it is
 * (suppressHydrationWarning covers the type attribute only), and a client
 * render creates an inert element without the warning.
 */
export function SongbookPrefsScript() {
  const isServer = typeof window === "undefined";
  return (
    <script
      type={isServer ? undefined : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: SONGBOOK_PREFS_BOOTSTRAP }}
    />
  );
}
