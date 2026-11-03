import { useSyncExternalStore } from "react";

/**
 * A setting remembered PER DEVICE in localStorage and shown as an attribute
 * on <html>: the song reader's size and view (D-124) and the colour theme
 * (§13.2). CSS keys on the attribute, and a head script sets it before the
 * first paint, so the page never jumps; these read and write the same
 * attribute afterwards. Every storage access is wrapped in try/catch (private
 * mode, blocked storage).
 */
export type HtmlPref<T> = {
  subscribe: (listener: () => void) => () => void;
  /** The value on <html> now. Client only. */
  read: () => T;
  /** Puts the value on <html>, remembers it and updates the hooks. */
  set: (value: T) => void;
};

export function createHtmlPref<T extends string | number>({
  attribute,
  storageKey,
  parse,
  apply = (value) => document.documentElement.setAttribute(attribute, String(value)),
}: {
  attribute: string;
  storageKey: string;
  /** An attribute value (or none) → a valid value; anything else gives the default. */
  parse: (value: string | null) => T;
  /** Puts a value on <html>. Default: the attribute. */
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
  };
}

const serverSnapshot = () => null;

/**
 * The value, or null on the server and during hydration: the server cannot
 * know a per-device setting, so a control shows no choice and stays disabled
 * until then, never the default as if it were the choice (TG-020).
 */
export function useHtmlPref<T>(pref: HtmlPref<T>): T | null {
  return useSyncExternalStore(pref.subscribe, pref.read, serverSnapshot);
}
