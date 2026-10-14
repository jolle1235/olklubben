import { describe, expect, it } from "vitest";

import { parseEnv } from "@/lib/env-schema";

const required = {
  DATABASE_URL: "postgresql://postgres@localhost:5432/olklubben_test",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3100",
};

describe("parseEnv", () => {
  it("accepts the required variables and leaves optional features off", () => {
    const result = parseEnv(required);

    expect(result.env.DATABASE_URL).toBe(required.DATABASE_URL);
    expect(result.env.DIRECT_URL).toBeUndefined();
    expect(result.env.SMTP_PORT).toBe(465);
    expect(result.isGoogleConfigured).toBe(false);
    expect(result.isSmtpConfigured).toBe(false);
    expect(result.warnings).toEqual([]);
  });

  it("lists every missing required variable in one error", () => {
    expect(() => parseEnv({})).toThrowError(
      /DATABASE_URL: mangler[\s\S]*BETTER_AUTH_SECRET: mangler[\s\S]*BETTER_AUTH_URL: mangler/,
    );
  });

  it("treats empty strings as not set", () => {
    expect(() => parseEnv({ ...required, BETTER_AUTH_SECRET: "" })).toThrowError(
      /BETTER_AUTH_SECRET: mangler/,
    );

    const result = parseEnv({ ...required, GOOGLE_CLIENT_ID: "", SMTP_PORT: "" });
    expect(result.env.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(result.env.SMTP_PORT).toBe(465);
  });

  it("rejects a short secret and a non-postgres database URL", () => {
    expect(() => parseEnv({ ...required, BETTER_AUTH_SECRET: "too-short" })).toThrowError(
      /BETTER_AUTH_SECRET: skal være mindst 32 tegn/,
    );
    expect(() => parseEnv({ ...required, DATABASE_URL: "mysql://localhost/db" })).toThrowError(
      /DATABASE_URL: skal være en postgresql:\/\/ connection string/,
    );
  });

  it("coerces SMTP_PORT to a number", () => {
    expect(parseEnv({ ...required, SMTP_PORT: "587" }).env.SMTP_PORT).toBe(587);
    expect(() => parseEnv({ ...required, SMTP_PORT: "abc" })).toThrowError(/SMTP_PORT/);
  });

  it("enables Google only when both id and secret are set", () => {
    expect(parseEnv({ ...required, GOOGLE_CLIENT_ID: "id" })).toMatchObject({
      isGoogleConfigured: false,
      warnings: [expect.stringContaining("GOOGLE_CLIENT_SECRET")],
    });
    expect(
      parseEnv({ ...required, GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" })
        .isGoogleConfigured,
    ).toBe(true);
  });

  it("enables SMTP only when host, user and password are set", () => {
    const smtp = { SMTP_HOST: "smtp.gmail.com", SMTP_USER: "klub@gmail.com" };

    expect(parseEnv({ ...required, SMTP_HOST: "smtp.gmail.com" })).toMatchObject({
      isSmtpConfigured: false,
      warnings: [],
    });
    expect(parseEnv({ ...required, ...smtp })).toMatchObject({
      isSmtpConfigured: false,
      warnings: [expect.stringContaining("SMTP_PASSWORD")],
    });
    expect(parseEnv({ ...required, ...smtp, SMTP_PASSWORD: "app-password" }).isSmtpConfigured).toBe(
      true,
    );
  });

  it("switches rate limiting off only outside production", () => {
    expect(parseEnv(required).isRateLimitDisabled).toBe(false);
    expect(parseEnv({ ...required, RATE_LIMIT_DISABLED: "1" }).isRateLimitDisabled).toBe(true);
    expect(parseEnv({ ...required, RATE_LIMIT_DISABLED: "true" }).isRateLimitDisabled).toBe(true);
    expect(parseEnv({ ...required, RATE_LIMIT_DISABLED: "0" }).isRateLimitDisabled).toBe(false);
    expect(parseEnv({ ...required, RATE_LIMIT_DISABLED: "" }).isRateLimitDisabled).toBe(false);

    const production = parseEnv({
      ...required,
      NODE_ENV: "production",
      RATE_LIMIT_DISABLED: "1",
      CRON_SECRET: "x".repeat(32),
    });
    expect(production.isRateLimitDisabled).toBe(false);
    expect(production.warnings).toEqual([expect.stringContaining("RATE_LIMIT_DISABLED")]);

    expect(() => parseEnv({ ...required, RATE_LIMIT_DISABLED: "maybe" })).toThrowError(
      /RATE_LIMIT_DISABLED/,
    );
  });

  it("reads the optional dev outbox directory", () => {
    expect(parseEnv(required).env.DEV_OUTBOX_DIR).toBeUndefined();
    expect(parseEnv({ ...required, DEV_OUTBOX_DIR: ".dev-outbox-e2e" }).env.DEV_OUTBOX_DIR).toBe(
      ".dev-outbox-e2e",
    );
  });

  it("accepts an optional CRON_SECRET of at least 16 characters (round 4)", () => {
    expect(parseEnv(required).env.CRON_SECRET).toBeUndefined();
    expect(parseEnv({ ...required, CRON_SECRET: "" }).env.CRON_SECRET).toBeUndefined();
    expect(parseEnv({ ...required, CRON_SECRET: "x".repeat(16) }).env.CRON_SECRET).toBe(
      "x".repeat(16),
    );
    expect(() => parseEnv({ ...required, CRON_SECRET: "kort" })).toThrowError(
      /CRON_SECRET: skal være mindst 16 tegn/,
    );
  });

  it("warns in production when CRON_SECRET is missing", () => {
    expect(parseEnv({ ...required, NODE_ENV: "production" }).warnings).toContain(
      "Den daglige lukning af afstemninger er slået fra: CRON_SECRET mangler.",
    );
    expect(
      parseEnv({ ...required, NODE_ENV: "production", CRON_SECRET: "x".repeat(32) }).warnings,
    ).toEqual([]);
    expect(parseEnv(required).warnings).toEqual([]);
  });
});
