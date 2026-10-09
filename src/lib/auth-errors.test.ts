import { describe, expect, it } from "vitest";

import { AUTH_ERROR_MESSAGES, getAuthErrorMessage, getOAuthErrorMessage } from "./auth-errors";

describe("getAuthErrorMessage", () => {
  it("never reveals whether an email exists on sign-in (SPEC §6.3)", () => {
    for (const code of ["INVALID_EMAIL_OR_PASSWORD", "USER_NOT_FOUND", "INVALID_PASSWORD"]) {
      expect(getAuthErrorMessage({ code, status: 401 }, "sign-in")).toBe(
        "Forkert email eller password.",
      );
    }
  });

  it("maps rate limiting (429) to a wait message, with or without a code", () => {
    expect(getAuthErrorMessage({ status: 429 }, "sign-in")).toBe(AUTH_ERROR_MESSAGES.rateLimited);
    expect(getAuthErrorMessage({ code: "TOO_MANY_REQUESTS", status: 429 }, "sign-up")).toBe(
      AUTH_ERROR_MESSAGES.rateLimited,
    );
  });

  it("explains sign-up problems", () => {
    expect(getAuthErrorMessage({ code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" }, "sign-up")).toBe(
      AUTH_ERROR_MESSAGES.emailTaken,
    );
    expect(getAuthErrorMessage({ code: "PASSWORD_TOO_SHORT" }, "sign-up")).toBe(
      "Password skal være mindst 8 tegn.",
    );
  });

  it("explains an expired or used reset link", () => {
    expect(getAuthErrorMessage({ code: "INVALID_TOKEN", status: 400 }, "reset-password")).toBe(
      AUTH_ERROR_MESSAGES.invalidResetToken,
    );
  });

  it("explains a wrong current password and a Google-only account (change-password)", () => {
    expect(getAuthErrorMessage({ code: "INVALID_PASSWORD" }, "change-password")).toBe(
      "Det nuværende password er forkert.",
    );
    expect(getAuthErrorMessage({ code: "CREDENTIAL_ACCOUNT_NOT_FOUND" }, "change-password")).toBe(
      "Du logger ind med Google og har intet password her.",
    );
    expect(getAuthErrorMessage({ code: "PASSWORD_TOO_SHORT" }, "change-password")).toBe(
      "Password skal være mindst 8 tegn.",
    );
    // Other flows keep their own meaning of the same codes.
    expect(getAuthErrorMessage({ code: "INVALID_PASSWORD" }, "sign-in")).toBe(
      "Forkert email eller password.",
    );
  });

  it("falls back to a generic message", () => {
    expect(getAuthErrorMessage(null)).toBe(AUTH_ERROR_MESSAGES.unexpected);
    expect(getAuthErrorMessage({ code: "SOMETHING_NEW", status: 500 }, "sign-in")).toBe(
      AUTH_ERROR_MESSAGES.unexpected,
    );
  });
});

describe("getOAuthErrorMessage", () => {
  it("returns null without an error", () => {
    expect(getOAuthErrorMessage(null)).toBeNull();
    expect(getOAuthErrorMessage("")).toBeNull();
  });

  it("explains a Google login that could not be linked (E19)", () => {
    expect(getOAuthErrorMessage("account_not_linked")).toContain("Log ind med email og password");
  });

  it("has a fallback for unknown codes", () => {
    expect(getOAuthErrorMessage("whatever")).toBe("Login med Google mislykkedes. Prøv igen.");
  });
});
