import { describe, expect, it } from "vitest";

import { BROWSER_THEME_COLOR } from "@/styles/tokens/browser-colors";

import {
  applyThemePref,
  parseThemePref,
  resolveTheme,
  THEME_ATTRIBUTE,
  THEME_BOOTSTRAP,
  THEME_COLOR_OVERRIDE_ATTRIBUTE,
  THEME_PREF_KEY,
  type ThemePref,
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
  it("follows the device only for system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});

/** A minimal fake page: <html>'s attributes and the override metas in <head>. */
function fakePage() {
  const attributes = new Map<string, string>();
  /** The override metas in <head> (first = what the browser uses). */
  const head: Map<string, string>[] = [];
  const element = (meta: Map<string, string>) => ({
    meta,
    setAttribute: (name: string, value: string) => meta.set(name, value),
    remove: () => {
      const index = head.indexOf(meta);
      if (index >= 0) head.splice(index, 1);
    },
  });
  const document = {
    documentElement: {
      getAttribute: (name: string) => attributes.get(name) ?? null,
      setAttribute: (name: string, value: string) => attributes.set(name, value),
      removeAttribute: (name: string) => attributes.delete(name),
    },
    createElement: () => element(new Map()),
    head: {
      prepend: ({ meta }: { meta: Map<string, string> }) => {
        const index = head.indexOf(meta);
        if (index >= 0) head.splice(index, 1);
        head.unshift(meta);
      },
    },
    querySelector: (selector: string) => {
      const meta = head.find(
        (m) =>
          selector === `meta[${THEME_COLOR_OVERRIDE_ATTRIBUTE}]` &&
          m.has(THEME_COLOR_OVERRIDE_ATTRIBUTE),
      );
      return meta ? element(meta) : null;
    },
  };
  return {
    document,
    theme: () => attributes.get(THEME_ATTRIBUTE),
    overrideColors: () => head.map((meta) => meta.get("content")),
    /** applyThemePref against this page (it reads the global document). */
    apply: (pref: ThemePref) => {
      const previous = globalThis.document;
      globalThis.document = document as unknown as Document;
      try {
        applyThemePref(pref);
      } finally {
        globalThis.document = previous;
      }
    },
  };
}

describe("applyThemePref", () => {
  it("sets data-theme and its own theme-color for an explicit choice", () => {
    const page = fakePage();
    page.apply("dark");
    expect(page.theme()).toBe("dark");
    expect(page.overrideColors()).toEqual([BROWSER_THEME_COLOR.dark]);

    page.apply("light");
    expect(page.theme()).toBe("light");
    expect(page.overrideColors()).toEqual([BROWSER_THEME_COLOR.light]);
  });

  it("removes both for system, so the CSS and the layout's metas follow the device", () => {
    const page = fakePage();
    page.apply("dark");
    page.apply("system");
    expect(page.theme()).toBeUndefined();
    expect(page.overrideColors()).toEqual([]);
  });
});

/** Runs THEME_BOOTSTRAP (the inlined source) against a fake page and storage. */
function runBootstrap(options: { stored?: string | null; storageThrows?: boolean }) {
  const page = fakePage();
  const localStorage = {
    getItem: (key: string) => {
      if (options.storageThrows) throw new Error("blocked");
      return key === THEME_PREF_KEY ? (options.stored ?? null) : null;
    },
  };
  new Function("document", "localStorage", THEME_BOOTSTRAP)(page.document, localStorage);
  return page;
}

describe("THEME_BOOTSTRAP", () => {
  it("leaves the page to the device when nothing is stored", () => {
    const page = runBootstrap({});
    expect(page.theme()).toBeUndefined();
    expect(page.overrideColors()).toEqual([]);
  });

  it("applies a stored choice", () => {
    const page = runBootstrap({ stored: "dark" });
    expect(page.theme()).toBe("dark");
    expect(page.overrideColors()).toEqual([BROWSER_THEME_COLOR.dark]);
  });

  it("ignores invalid values and blocked storage", () => {
    expect(runBootstrap({ stored: "purple" }).theme()).toBeUndefined();
    expect(runBootstrap({ storageThrows: true }).theme()).toBeUndefined();
  });
});
