"use client";

import { HeadScript } from "@/components/features/head-script";
import { SONGBOOK_PREFS_BOOTSTRAP } from "@/lib/songbook-prefs";

/** The songbook reader's font size and view on <html> before the first paint (D-124). */
export function SongbookPrefsScript() {
  return <HeadScript code={SONGBOOK_PREFS_BOOTSTRAP} />;
}
