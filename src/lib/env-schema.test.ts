import { describe, expect, it } from "vitest";

import { parseAppAdminEmails, parseEnv } from "@/lib/env-schema";

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

  it("enables Auth0 only when domain, id and secret are set, and lets it win over Google (D-166)", () => {
    const auth0 = {
      AUTH0_DOMAIN: "olklubben.eu.auth0.com",
      AUTH0_CLIENT_ID: "id",
      AUTH0_CLIENT_SECRET: "secret",
    };
    const google = { GOOGLE_CLIENT_ID: "gid", GOOGLE_CLIENT_SECRET: "gsecret" };

    expect(parseEnv(required).externalProvider).toBeNull();
    expect(parseEnv({ ...required, ...google }).externalProvider).toBe("google");
    expect(parseEnv({ ...required, ...auth0 })).toMatchObject({
      isAuth0Configured: true,
      externalProvider: "auth0",
      warnings: [],
    });
    expect(parseEnv({ ...required, ...auth0, ...google })).toMatchObject({
      externalProvider: "auth0",
      warnings: ["Google-login er slået fra, fordi Auth0 er sat op (Google ligger i Auth0)."],
    });
    expect(parseEnv({ ...required, AUTH0_DOMAIN: auth0.AUTH0_DOMAIN })).toMatchObject({
      isAuth0Configured: false,
      externalProvider: null,
      warnings: [expect.stringContaining("AUTH0_CLIENT_SECRET")],
    });
  });

  it("rejects an AUTH0_DOMAIN with a scheme or a path", () => {
    for (const value of ["https://olklubben.eu.auth0.com", "olklubben.eu.auth0.com/", "x"]) {
      expect(() => parseEnv({ ...required, AUTH0_DOMAIN: value })).toThrowError(
        /AUTH0_DOMAIN: skal være et domænenavn uden https:\/\//,
      );
    }
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
      APP_ADMIN_EMAILS: "jesper@example.com",
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
      parseEnv({
        ...required,
        NODE_ENV: "production",
        CRON_SECRET: "x".repeat(32),
        APP_ADMIN_EMAILS: "jesper@example.com",
      }).warnings,
    ).toEqual([]);
    expect(parseEnv(required).warnings).toEqual([]);
  });
});

describe("parseEnv: APP_ADMIN_EMAILS (feedback, §9.9, D-142)", () => {
  const NO_ADMIN_WARNING =
    "Ingen app-admin: APP_ADMIN_EMAILS er tom, så feedback-status kan ikke ændres.";

  it("splits on commas, trims, lowercases, drops empty entries and de-duplicates", () => {
    const result = parseEnv({
      ...required,
      APP_ADMIN_EMAILS: " Jesper@Example.com , ,mads@example.com,JESPER@example.com,",
    });
    expect(result.appAdminEmails).toEqual(["jesper@example.com", "mads@example.com"]);
  });

  it("is an empty list when unset, empty or only commas", () => {
    expect(parseEnv(required).appAdminEmails).toEqual([]);
    expect(parseEnv({ ...required, APP_ADMIN_EMAILS: "" }).appAdminEmails).toEqual([]);
    expect(parseEnv({ ...required, APP_ADMIN_EMAILS: "   " }).appAdminEmails).toEqual([]);
    expect(parseEnv({ ...required, APP_ADMIN_EMAILS: " , ," }).appAdminEmails).toEqual([]);
  });

  it("fails startup naming every entry that is not an email", () => {
    expect(() =>
      parseEnv({ ...required, APP_ADMIN_EMAILS: "jesper@example.com,foo" }),
    ).toThrowError("APP_ADMIN_EMAILS: «foo» er ikke en gyldig email");
    expect(() =>
      parseEnv({ ...required, APP_ADMIN_EMAILS: "jesper@example.com; mads@example.com" }),
    ).toThrowError(
      /APP_ADMIN_EMAILS: «jesper@example.com; mads@example.com» er ikke en gyldig email/,
    );
    expect(() => parseEnv({ ...required, APP_ADMIN_EMAILS: "a, b@" })).toThrowError(
      /«a» er ikke en gyldig email[\s\S]*«b@» er ikke en gyldig email/,
    );
  });

  it("warns in production only, when the list is empty", () => {
    const production = { ...required, NODE_ENV: "production", CRON_SECRET: "x".repeat(32) };
    expect(parseEnv(production).warnings).toEqual([NO_ADMIN_WARNING]);
    expect(parseEnv({ ...production, APP_ADMIN_EMAILS: " , " }).warnings).toEqual([
      NO_ADMIN_WARNING,
    ]);
    expect(parseEnv({ ...production, APP_ADMIN_EMAILS: "jesper@example.com" }).warnings).toEqual(
      [],
    );
    expect(parseEnv(required).warnings).not.toContain(NO_ADMIN_WARNING);
  });
});

describe("parseEnv: the app's base URL (D-164)", () => {
  const vercelProduction = {
    ...required,
    BETTER_AUTH_URL: undefined,
    VERCEL_ENV: "production",
    VERCEL_PROJECT_PRODUCTION_URL: "olklubben-abc.vercel.app",
  };

  it("is BETTER_AUTH_URL without a trailing slash outside Vercel Production", () => {
    expect(parseEnv(required).appBaseUrl).toBe("http://localhost:3100");
    expect(parseEnv({ ...required, BETTER_AUTH_URL: "https://x.example/" }).appBaseUrl).toBe(
      "https://x.example",
    );
  });

  it("is the production domain on Vercel Production, without BETTER_AUTH_URL", () => {
    const result = parseEnv(vercelProduction);
    expect(result.appBaseUrl).toBe("https://olklubben-abc.vercel.app");
    expect(result.warnings).not.toContainEqual(expect.stringContaining("BETTER_AUTH_URL"));
  });

  it("ignores a different BETTER_AUTH_URL on Vercel Production, with a warning", () => {
    const result = parseEnv({
      ...vercelProduction,
      BETTER_AUTH_URL: "https://olklubben-9f8e7d6c5-jespers-projects.vercel.app",
    });
    expect(result.appBaseUrl).toBe("https://olklubben-abc.vercel.app");
    expect(result.warnings).toContain(
      "BETTER_AUTH_URL (https://olklubben-9f8e7d6c5-jespers-projects.vercel.app) ignoreres i produktion: appen bruger https://olklubben-abc.vercel.app (VERCEL_PROJECT_PRODUCTION_URL).",
    );
    expect(
      parseEnv({ ...vercelProduction, BETTER_AUTH_URL: "https://olklubben-abc.vercel.app/" })
        .warnings,
    ).not.toContainEqual(expect.stringContaining("BETTER_AUTH_URL"));
  });

  it("uses BETTER_AUTH_URL on previews, where the production domain is also set", () => {
    const preview = { ...vercelProduction, VERCEL_ENV: "preview" };
    expect(parseEnv({ ...preview, BETTER_AUTH_URL: "https://preview.example" }).appBaseUrl).toBe(
      "https://preview.example",
    );
    expect(() => parseEnv(preview)).toThrowError(/BETTER_AUTH_URL: mangler/);
  });

  it("rejects a production domain that is not a bare hostname", () => {
    for (const value of ["https://olklubben.vercel.app", "evil.example/path", "host:3000"]) {
      expect(() =>
        parseEnv({ ...vercelProduction, VERCEL_PROJECT_PRODUCTION_URL: value }),
      ).toThrowError(/VERCEL_PROJECT_PRODUCTION_URL: skal være et domænenavn/);
    }
  });
});

describe("parseAppAdminEmails", () => {
  it("returns the valid emails and the invalid entries as written", () => {
    expect(parseAppAdminEmails(undefined)).toEqual({ emails: [], invalid: [] });
    expect(parseAppAdminEmails(" A@Example.com ,nope , a@example.com")).toEqual({
      emails: ["a@example.com"],
      invalid: ["nope"],
    });
  });
});
