import { describe, expect, it, vi } from "vitest";

// app-url reads the validated env; only the base URL matters here (parseEnv
// derives it, see env-schema.test.ts).
vi.mock("@/env", () => ({ appBaseUrl: "https://olklubben.example" }));

const { inviteUrl, passwordResetUrl } = await import("./app-url");

describe("passwordResetUrl", () => {
  it("links to our own page with the token (also the admin link)", () => {
    expect(passwordResetUrl("abc123")).toBe(
      "https://olklubben.example/reset-password?token=abc123",
    );
    expect(passwordResetUrl("abc123", null)).toBe(
      "https://olklubben.example/reset-password?token=abc123",
    );
  });

  it("carries a safe next (an invitation) along, encoded", () => {
    expect(passwordResetUrl("abc123", "/join/K7XMQ2PA")).toBe(
      "https://olklubben.example/reset-password?token=abc123&next=%2Fjoin%2FK7XMQ2PA",
    );
  });

  it("drops an unsafe next", () => {
    expect(passwordResetUrl("abc123", "//evil.example")).toBe(
      "https://olklubben.example/reset-password?token=abc123",
    );
  });
});

describe("inviteUrl", () => {
  it("builds the join link without a double slash", () => {
    expect(inviteUrl("K7XMQ2PA")).toBe("https://olklubben.example/join/K7XMQ2PA");
  });
});
