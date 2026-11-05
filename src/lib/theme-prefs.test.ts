import { describe, expect, it } from "vitest";

import { BROWSER_THEME_COLOR } from "@/styles/tokens/browser-colors";

import {
  applyThemePref,
  THEME_ATTRIBUTE,
  THEME_BOOTSTRAP,
  THEME_COLOR_OVERRIDE_ATTRIBUTE,
  THEME_PREF_KEY,
  type ThemePref,
} from "./theme-prefs";

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
  it("switches data-theme and its own theme-color, and removes both for system (F-090)", () => {
    const page = fakePage();
    page.apply("dark");
    page.apply("light");
    expect(page.theme()).toBe("light");
    expect(page.overrideColors()).toEqual([BROWSER_THEME_COLOR.light]);

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
