import { useSyncExternalStore } from "react";

/**
 * A per-device setting kept in localStorage and mirrored as an attribute on
 * <html>, which CSS keys on. A head script sets it before the first paint
 * (HeadScript); this reads and writes it afterwards.
 */
export type HtmlPref<T> = {
  subscribe: (listener: () => void) => () => void;
  /** Client only. */
  read: () => T;
  set: (value: T) => void;
  /** Client only. Applies the stored value again, e.g. after React reset <html>'s attributes. */
  restore: () => void;
};

export function createHtmlPref<T extends string | number>({
  attribute,
  storageKey,
  parse,
  apply = (value) => document.documentElement.setAttribute(attribute, String(value)),
}: {
  attribute: string;
  storageKey: string;
  /** Maps a missing or invalid value to the default. */
  parse: (value: string | null) => T;
  apply?: (value: T) => void;
}): HtmlPref<T> {
  const listeners = new Set<() => void>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    read: () => parse(document.documentElement.getAttribute(attribute)),
    set(value) {
      apply(value);
      try {
        window.localStorage.setItem(storageKey, String(value));
      } catch {
        // Storage blocked: the attribute still applies until the next hard load.
      }
      for (const listener of listeners) listener();
    },
    restore() {
      let stored: string | null;
      try {
        stored = window.localStorage.getItem(storageKey);
      } catch {
        // Storage blocked: the attribute is all there is.
        stored = document.documentElement.getAttribute(attribute);
      }
      apply(parse(stored));
      for (const listener of listeners) listener();
    },
  };
}

const serverSnapshot = () => null;

/**
 * Null on the server and during hydration: the server can't know a per-device
 * setting, so controls show no choice and stay disabled until then (TG-020).
 */
export function useHtmlPref<T>(pref: HtmlPref<T>): T | null {
  return useSyncExternalStore(pref.subscribe, pref.read, serverSnapshot);
}
