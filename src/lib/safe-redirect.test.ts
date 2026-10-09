import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it.each([
    ["/", "/"],
    ["/join/K7XMQ2PA", "/join/K7XMQ2PA"],
    ["/c/abc/beers?sort=name&dir=asc", "/c/abc/beers?sort=name&dir=asc"],
    ["/c/abc#top", "/c/abc#top"],
    ["/c/abc/../clubs", "/c/clubs"],
  ])("accepts the same-origin path %j", (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });

  it("percent-encodes non-ASCII characters", () => {
    expect(safeRedirectPath("/søg")).toBe("/s%C3%B8g");
  });

  it.each([
    ["https://evil.com", "absolute URL"],
    ["http://localhost:3000/c/abc", "absolute URL to ourselves"],
    ["//evil.com", "protocol-relative URL"],
    ["//evil.com/path", "protocol-relative URL with path"],
    ["/\\evil.com", "backslash"],
    ["\\\\evil.com", "double backslash"],
    ["/\t/evil.com", "tab (browsers strip it → //evil.com)"],
    ["/\n/evil.com", "newline"],
    ["/ /evil.com", "space"],
    ["javascript:alert(1)", "javascript: URL"],
    ["evil.com", "no leading slash"],
    ["c/abc", "relative path"],
    ["", "empty"],
    ["/a/..//evil.com", "dot segments that collapse into //"],
  ])("rejects %j (%s)", (input) => {
    expect(safeRedirectPath(input)).toBeNull();
  });

  it("rejects non-strings and absurdly long values", () => {
    expect(safeRedirectPath(undefined)).toBeNull();
    expect(safeRedirectPath(null)).toBeNull();
    expect(safeRedirectPath(["/c/abc"])).toBeNull();
    expect(safeRedirectPath(`/${"a".repeat(3000)}`)).toBeNull();
  });
});
