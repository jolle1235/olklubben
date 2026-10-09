import { APIError } from "better-auth/api";
import { describe, expect, it } from "vitest";

import { AUTH_ERROR_MESSAGES } from "@/lib/auth-errors";

import { toAuthActionError } from "./errors";

describe("toAuthActionError", () => {
  it("gives RATE_LIMITED with the wait in minutes for our 429 (like join-with-code)", () => {
    const error = new APIError("TOO_MANY_REQUESTS", {
      code: "TOO_MANY_REQUESTS",
      message: "For mange forsøg. Prøv igen om 5 minutter.",
      retryAfterSeconds: 241,
    });

    for (const flow of ["sign-in", "sign-up", "reset-password"] as const) {
      expect(toAuthActionError(error, flow)).toEqual({
        ok: false,
        error: { code: "RATE_LIMITED", message: "For mange forsøg. Prøv igen om 5 minutter." },
      });
    }
  });

  it("falls back to the general wait text when the 429 has no usable retryAfterSeconds", () => {
    for (const body of [undefined, { code: "TOO_MANY_REQUESTS" }, { retryAfterSeconds: "60" }]) {
      expect(toAuthActionError(new APIError("TOO_MANY_REQUESTS", body), "sign-in").error).toEqual({
        code: "RATE_LIMITED",
        message: AUTH_ERROR_MESSAGES.rateLimited,
      });
    }
  });

  it("keeps sign-in errors generic (§6.3)", () => {
    const error = new APIError("UNAUTHORIZED", { code: "INVALID_EMAIL_OR_PASSWORD" });
    expect(toAuthActionError(error, "sign-in").error).toEqual({
      code: "INVALID_EMAIL_OR_PASSWORD",
      message: AUTH_ERROR_MESSAGES.invalidCredentials,
    });
  });

  it("puts a wrong current password on the currentPassword field (change-password)", () => {
    const error = new APIError("BAD_REQUEST", { code: "INVALID_PASSWORD" });
    expect(toAuthActionError(error, "change-password")).toEqual({
      ok: false,
      error: {
        code: "INVALID_PASSWORD",
        message: AUTH_ERROR_MESSAGES.currentPasswordWrong,
        fieldErrors: { currentPassword: [AUTH_ERROR_MESSAGES.currentPasswordWrong] },
      },
    });
  });

  it("explains a Google-only account as a form error (change-password)", () => {
    const error = new APIError("BAD_REQUEST", { code: "CREDENTIAL_ACCOUNT_NOT_FOUND" });
    expect(toAuthActionError(error, "change-password").error).toEqual({
      code: "CREDENTIAL_ACCOUNT_NOT_FOUND",
      message: AUTH_ERROR_MESSAGES.noPasswordLogin,
    });
  });

  it("rethrows anything that is not a Better Auth error", () => {
    const error = new Error("database is down");
    expect(() => toAuthActionError(error, "sign-up")).toThrow(error);
  });
});
