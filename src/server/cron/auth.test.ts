import { describe, expect, it } from "vitest";

import { isCronAuthorized } from "./auth";

const SECRET = "itest-cron-secret-0123456789abcdef";

describe("isCronAuthorized (§4.8)", () => {
  it("accepts exactly «Bearer <secret>»", () => {
    expect(isCronAuthorized(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it("refuses a wrong or missing header", () => {
    expect(isCronAuthorized(`Bearer ${SECRET}x`, SECRET)).toBe(false);
    expect(isCronAuthorized("Bearer nope", SECRET)).toBe(false);
    expect(isCronAuthorized(null, SECRET)).toBe(false);
    expect(isCronAuthorized("", SECRET)).toBe(false);
  });

  it("refuses another scheme and other spellings", () => {
    expect(isCronAuthorized(`Basic ${SECRET}`, SECRET)).toBe(false);
    expect(isCronAuthorized(SECRET, SECRET)).toBe(false);
    expect(isCronAuthorized(`bearer ${SECRET}`, SECRET)).toBe(false);
    expect(isCronAuthorized(`Bearer  ${SECRET}`, SECRET)).toBe(false);
  });

  it("handles headers of a different length without throwing", () => {
    expect(isCronAuthorized("B", SECRET)).toBe(false);
    expect(isCronAuthorized(`Bearer ${SECRET.repeat(100)}`, SECRET)).toBe(false);
  });

  it("never authorizes with an empty secret", () => {
    expect(isCronAuthorized("Bearer ", "")).toBe(false);
  });
});
