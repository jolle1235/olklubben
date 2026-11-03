import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("keeps a text role next to a text colour", () => {
    expect(cn("text-title-sm", "text-primary-ink")).toBe("text-title-sm text-primary-ink");
  });

  it("treats a role's tight and loose variants as text sizes too", () => {
    expect(cn("text-body-sm-tight", "text-foreground")).toBe("text-body-sm-tight text-foreground");
    expect(cn("text-body-sm", "text-body-sm-loose")).toBe("text-body-sm-loose");
  });

  it("lets the last text role win, like any other size", () => {
    expect(cn("text-body-md text-foreground", "text-label-lg")).toBe(
      "text-foreground text-label-lg",
    );
  });

  it("lets the last text colour win", () => {
    expect(cn("text-body-sm text-muted-foreground", "text-foreground")).toBe(
      "text-body-sm text-foreground",
    );
  });
});
