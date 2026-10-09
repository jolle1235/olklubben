import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  ACTION_ERROR_CODES,
  fail,
  formatWait,
  ok,
  rateLimitedError,
  unexpectedError,
  validationError,
} from "./action-result";

describe("action results (SPEC §4.3)", () => {
  it("ok() wraps data", () => {
    expect(ok({ clubId: "a" })).toEqual({ ok: true, data: { clubId: "a" } });
    expect(ok()).toEqual({ ok: true, data: undefined });
  });

  it("fail() omits fieldErrors when there are none", () => {
    expect(fail("CONFLICT", "Findes allerede.")).toEqual({
      ok: false,
      error: { code: "CONFLICT", message: "Findes allerede." },
    });
  });

  it("validationError() groups Zod issues per field", () => {
    const schema = z
      .object({ name: z.string().min(1, "Skriv et navn."), age: z.number({ error: "Tal!" }) })
      .refine(() => false, { message: "Hele formularen er forkert." });
    const result = schema.safeParse({ name: "", age: "x" });
    expect(result.success).toBe(false);
    if (result.success) return;

    expect(validationError(result.error)).toEqual({
      ok: false,
      error: {
        code: ACTION_ERROR_CODES.VALIDATION,
        message: "Tjek felterne og prøv igen.",
        fieldErrors: { name: ["Skriv et navn."], age: ["Tal!"] },
      },
    });
  });

  it("puts form-level issues under _form", () => {
    const schema = z.object({ a: z.string() }).refine(() => false, { message: "Nej." });
    const result = schema.safeParse({ a: "x" });
    if (result.success) throw new Error("expected failure");
    expect(validationError(result.error).error.fieldErrors).toEqual({ _form: ["Nej."] });
  });

  it("rateLimitedError() mentions the wait in Danish", () => {
    expect(rateLimitedError(45).error).toEqual({
      code: "RATE_LIMITED",
      message: "For mange forsøg. Prøv igen om 45 sekunder.",
    });
    expect(rateLimitedError(61).error.message).toBe("For mange forsøg. Prøv igen om 2 minutter.");
    expect(rateLimitedError().error.message).toBe("For mange forsøg. Vent lidt, og prøv igen.");
  });

  it("formatWait() writes the wait in Danish, rounding up to whole minutes", () => {
    expect(formatWait(1)).toBe("1 sekund");
    expect(formatWait(59)).toBe("59 sekunder");
    expect(formatWait(60)).toBe("1 minut");
    expect(formatWait(61)).toBe("2 minutter");
    expect(formatWait(600)).toBe("10 minutter");
  });

  it("unexpectedError() has a safe default message", () => {
    expect(unexpectedError().error).toEqual({
      code: "UNEXPECTED_ERROR",
      message: "Noget gik galt – prøv igen. Vi har tørret disken af.",
    });
  });
});
