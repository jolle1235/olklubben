import { describe, expect, it } from "vitest";

import { cn } from "./utils";

// F-091: without the type scale's roles, cn reads text-title-sm as a colour and drops it.
describe("cn", () => {
  it("keeps a text role next to a text colour", () => {
    expect(cn("text-title-sm", "text-primary-ink")).toBe("text-title-sm text-primary-ink");
    expect(cn("text-body-sm-tight", "text-foreground")).toBe("text-body-sm-tight text-foreground");
  });

  it("merges two text roles like two sizes", () => {
    expect(cn("text-body-sm", "text-body-sm-loose")).toBe("text-body-sm-loose");
  });
});
