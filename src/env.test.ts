import { afterEach, describe, expect, it, vi } from "vitest";

// Also proves that modules importing "server-only" can be unit-tested
// (see the alias in vitest.config.mts).
describe("@/env", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  function stubRequired() {
    vi.stubEnv("DATABASE_URL", "postgresql://postgres@localhost:5432/olklubben_test");
    vi.stubEnv("BETTER_AUTH_SECRET", "s".repeat(32));
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3100");
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    vi.stubEnv("AUTH0_DOMAIN", "");
    vi.stubEnv("AUTH0_CLIENT_ID", "");
    vi.stubEnv("AUTH0_CLIENT_SECRET", "");
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("SMTP_USER", "");
    vi.stubEnv("SMTP_PASSWORD", "");
  }

  it("validates process.env when imported", async () => {
    stubRequired();

    const { env, externalProvider, isSmtpConfigured } = await import("@/env");

    expect(env.BETTER_AUTH_URL).toBe("http://localhost:3100");
    expect(externalProvider).toBeNull();
    expect(isSmtpConfigured).toBe(false);
  });

  it("fails with a clear error when a required variable is missing", async () => {
    stubRequired();
    vi.stubEnv("BETTER_AUTH_SECRET", "");

    await expect(import("@/env")).rejects.toThrowError(/BETTER_AUTH_SECRET: mangler/);
  });
});
