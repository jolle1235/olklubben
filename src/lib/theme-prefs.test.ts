import { describe, expect, it } from "vitest";

import { BROWSER_THEME_COLOR } from "@/styles/tokens/browser-colors";

import {
  parseThemePref,
  resolveTheme,
  THEME_ATTRIBUTE,
  THEME_BOOTSTRAP,
  THEME_COLOR_OVERRIDE_ATTRIBUTE,
  THEME_PREF_ATTRIBUTE,
  THEME_PREF_KEY,
} from "./theme-prefs";

describe("parseThemePref", () => {
  it("keeps the three choices", () => {
    expect(parseThemePref("system")).toBe("system");
    expect(parseThemePref("light")).toBe("light");
    expect(parseThemePref("dark")).toBe("dark");
  });

  it("falls back to system for anything else", () => {
    expect(parseThemePref(null)).toBe("system");
    expect(parseThemePref(undefined)).toBe("system");
    expect(parseThemePref("Dark")).toBe("system");
  });
});

describe("resolveTheme", () => {
  it("follows the system only for system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});

/** Runs THEME_BOOTSTRAP against a minimal fake browser. */
function runBootstrap(options: {
  stored?: string | null;
  systemDark?: boolean;
  storageThrows?: boolean;
}) {
  const attributes = new Map<string, string>();
  /** The override metas the script put in <head> (first = what the browser uses). */
  const head: Map<string, string>[] = [];
  const schemeListeners: (() => void)[] = [];
  const query = { matches: options.systemDark ?? false };
  const fakeWindow = {
    matchMedia: () => ({
      get matches() {
        return query.matches;
      },
      addEventListener: (_: string, listener: () => void) => schemeListeners.push(listener),
    }),
    addEventListener: () => {},
  };
  const fakeDocument = {
    documentElement: {
      getAttribute: (name: string) => attributes.get(name) ?? null,
      setAttribute: (name: string, value: string) => attributes.set(name, value),
    },
    createElement: () => {
      const meta = new Map<string, string>();
      return {
        meta,
        setAttribute: (name: string, value: string) => meta.set(name, value),
        remove: () => head.splice(head.indexOf(meta), 1),
      };
    },
    head: { prepend: (element: { meta: Map<string, string> }) => head.unshift(element.meta) },
    querySelector: (selector: string) => {
      const meta = head.find(
        (m) =>
          selector === `meta[${THEME_COLOR_OVERRIDE_ATTRIBUTE}]` &&
          m.has(THEME_COLOR_OVERRIDE_ATTRIBUTE),
      );
      return meta
        ? {
            setAttribute: (name: string, value: string) => meta.set(name, value),
            remove: () => head.splice(head.indexOf(meta), 1),
          }
        : null;
    },
  };
  const fakeStorage = {
    getItem: (key: string) => {
      if (options.storageThrows) throw new Error("blocked");
      return key === THEME_PREF_KEY ? (options.stored ?? null) : null;
    },
  };
  new Function("window", "document", "localStorage", THEME_BOOTSTRAP)(
    fakeWindow,
    fakeDocument,
    fakeStorage,
  );
  return {
    theme: () => attributes.get(THEME_ATTRIBUTE),
    pref: () => attributes.get(THEME_PREF_ATTRIBUTE),
    setPref: (pref: string) => attributes.set(THEME_PREF_ATTRIBUTE, pref),
    overrideColors: () => head.map((meta) => meta.get("content")),
    setSystemDark: (dark: boolean) => {
      query.matches = dark;
      for (const listener of schemeListeners) listener();
    },
  };
}

describe("THEME_BOOTSTRAP", () => {
  it("follows the system when nothing is stored", () => {
    expect(runBootstrap({ systemDark: true }).theme()).toBe("dark");
    const light = runBootstrap({ systemDark: false });
    expect(light.theme()).toBe("light");
    expect(light.pref()).toBe("system");
  });

  it("uses a stored choice over the system", () => {
    const page = runBootstrap({ stored: "dark", systemDark: false });
    expect(page.theme()).toBe("dark");
    expect(page.pref()).toBe("dark");
  });

  it("ignores invalid values and blocked storage", () => {
    expect(runBootstrap({ stored: "purple", systemDark: true }).pref()).toBe("system");
    expect(runBootstrap({ storageThrows: true, systemDark: true }).theme()).toBe("dark");
  });

  it("follows a system change only while the choice is system", () => {
    const page = runBootstrap({ systemDark: false });
    page.setSystemDark(true);
    expect(page.theme()).toBe("dark");

    page.setPref("light");
    page.setSystemDark(false);
    page.setSystemDark(true);
    expect(page.theme()).toBe("light");
  });

  it("adds its own theme-color only for an explicit choice", () => {
    expect(runBootstrap({ systemDark: true }).overrideColors()).toEqual([]);
    const dark = runBootstrap({ stored: "dark", systemDark: false });
    expect(dark.overrideColors()).toEqual([BROWSER_THEME_COLOR.dark]);

    dark.setPref("system");
    dark.setSystemDark(false);
    expect(dark.overrideColors()).toEqual([]);
  });
});
