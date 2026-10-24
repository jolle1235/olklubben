import { describe, expect, it } from "vitest";

import {
  MAX_REMEMBERED_EMAILS,
  parseRememberedEmails,
  withoutRememberedEmail,
  withRememberedEmail,
} from "./remembered-emails";

describe("remembered emails (D-157)", () => {
  it("puts the newest first, lowercased and without duplicates", () => {
    const list = withRememberedEmail(["a@example.com", "b@example.com"], " B@Example.com ");
    expect(list).toEqual(["b@example.com", "a@example.com"]);
  });

  it("keeps at most five and ignores what is not an email", () => {
    let list: string[] = [];
    for (let i = 0; i < 7; i += 1) list = withRememberedEmail(list, `u${i}@example.com`);
    expect(list).toHaveLength(MAX_REMEMBERED_EMAILS);
    expect(list[0]).toBe("u6@example.com");
    expect(withRememberedEmail(list, "ikke en email")).toEqual(list);
  });

  it("removes an email", () => {
    expect(withoutRememberedEmail(["a@example.com", "b@example.com"], "A@example.com")).toEqual([
      "b@example.com",
    ]);
  });

  it("reads only a JSON list of emails", () => {
    expect(parseRememberedEmails(null)).toEqual([]);
    expect(parseRememberedEmails("{")).toEqual([]);
    expect(parseRememberedEmails('{"a":1}')).toEqual([]);
    expect(parseRememberedEmails('["X@example.com", 3, "x@example.com", "nej"]')).toEqual([
      "x@example.com",
    ]);
  });
});
