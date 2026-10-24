import { describe, expect, it } from "vitest";

import {
  MAX_REMEMBERED_EMAILS,
  normalizeRememberedEmail,
  parseRememberedEmails,
  withRememberedEmail,
} from "./remembered-emails";

describe("remembered emails (D-157)", () => {
  it("normalises like the forms' emailSchema and refuses what is not an email", () => {
    expect(normalizeRememberedEmail(" B@Example.com ")).toBe("b@example.com");
    expect(normalizeRememberedEmail("ikke en email")).toBeNull();
  });

  it("puts the newest first without duplicates and keeps at most five", () => {
    expect(withRememberedEmail(["a@example.com", "b@example.com"], "b@example.com")).toEqual([
      "b@example.com",
      "a@example.com",
    ]);
    let list: string[] = [];
    for (let i = 0; i < 7; i += 1) list = withRememberedEmail(list, `u${i}@example.com`);
    expect(list).toHaveLength(MAX_REMEMBERED_EMAILS);
    expect(list[0]).toBe("u6@example.com");
  });

  it("reads only a JSON list of strings", () => {
    expect(parseRememberedEmails(null)).toEqual([]);
    expect(parseRememberedEmails("{")).toEqual([]);
    expect(parseRememberedEmails('{"a":1}')).toEqual([]);
    expect(parseRememberedEmails('["x@example.com", 3]')).toEqual(["x@example.com"]);
  });
});
