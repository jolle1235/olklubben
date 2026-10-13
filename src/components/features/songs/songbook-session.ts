/**
 * sessionStorage keys of the songbook (never song text): the list URL with the
 * search, for "‹ Sangbog" in the reader, and the last opened song, so the list
 * can scroll back to it.
 */
export const SONGBOOK_LIST_URL_KEY = "olklubben.songbook.listUrl";
export const SONGBOOK_LAST_SONG_KEY = "olklubben.songbook.lastSongId";

/** sessionStorage.setItem, silent when storage is blocked. */
export function storeSession(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the feature just does nothing.
  }
}

/** Reads and removes a sessionStorage value (null when missing or blocked). */
export function takeSession(key: string): string | null {
  try {
    const value = window.sessionStorage.getItem(key);
    if (value !== null) window.sessionStorage.removeItem(key);
    return value;
  } catch {
    return null;
  }
}
