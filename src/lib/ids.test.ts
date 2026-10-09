import { describe, expect, it } from "vitest";

import { isValidId } from "./ids";

describe("isValidId", () => {
  it("accepts UUIDs (v7 from Prisma, v4, any case)", () => {
    expect(isValidId("0199c4a5-3f1e-7c2a-9b1d-2f3e4a5b6c7d")).toBe(true);
    expect(isValidId("3F2504E0-4F89-41D3-9A0C-0305E82C3301")).toBe(true);
  });

  it("rejects anything else, so a bad URL gives 404 and not a database error", () => {
    for (const value of [
      "",
      "abc",
      "1",
      "0199c4a5-3f1e-7c2a-9b1d-2f3e4a5b6c7",
      "0199c4a5-3f1e-7c2a-9b1d-2f3e4a5b6c7d0",
      "0199c4a5_3f1e_7c2a_9b1d_2f3e4a5b6c7d",
      "' OR 1=1 --",
      undefined,
      null,
      42,
    ]) {
      expect(isValidId(value)).toBe(false);
    }
  });
});
