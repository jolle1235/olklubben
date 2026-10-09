import { describe, expect, it } from "vitest";

import { assertMigrationUrlSafe, resolveMigrationUrl } from "./migration-url";

const LOCAL = "postgresql://postgres@localhost:5432/olklubben_dev";
const NEON_DIRECT = "postgresql://u:p@ep-cool-name-123456.eu-central-1.aws.neon.tech/neondb";
const NEON_POOLED = "postgresql://u:p@ep-cool-name-123456-pooler.eu-central-1.aws.neon.tech/neondb";
const PRODUCTION_DIRECT = "postgresql://u:p@ep-main-999999.eu-central-1.aws.neon.tech/neondb";

describe("resolveMigrationUrl (prisma.config.ts)", () => {
  it("prefers DIRECT_URL, then DATABASE_URL_UNPOOLED, then DATABASE_URL", () => {
    const all = {
      DIRECT_URL: LOCAL,
      DATABASE_URL_UNPOOLED: NEON_DIRECT,
      DATABASE_URL: NEON_POOLED,
    };
    expect(resolveMigrationUrl(all)).toBe(LOCAL);
    expect(resolveMigrationUrl({ ...all, DIRECT_URL: undefined })).toBe(NEON_DIRECT);
    expect(resolveMigrationUrl({ DATABASE_URL: NEON_POOLED })).toBe(NEON_POOLED);
  });

  it("treats empty values as not set", () => {
    expect(
      resolveMigrationUrl({ DIRECT_URL: "", DATABASE_URL_UNPOOLED: "", DATABASE_URL: LOCAL }),
    ).toBe(LOCAL);
  });

  it("returns undefined without any URL (prisma generate on a fresh clone)", () => {
    expect(resolveMigrationUrl({})).toBeUndefined();
  });
});

describe("assertMigrationUrlSafe", () => {
  it("does nothing outside Vercel, also with DIRECT_URL or a pooled URL", () => {
    expect(() => assertMigrationUrlSafe({})).not.toThrow();
    expect(() => assertMigrationUrlSafe({ DATABASE_URL: LOCAL })).not.toThrow();
    expect(() =>
      assertMigrationUrlSafe({ DIRECT_URL: LOCAL, VERCEL_ENV: "preview" }),
    ).not.toThrow();
    expect(() => assertMigrationUrlSafe({ DATABASE_URL: NEON_POOLED })).not.toThrow();
  });

  it("refuses DIRECT_URL on a Preview deployment, so a preview never migrates production", () => {
    expect(() =>
      assertMigrationUrlSafe({
        VERCEL: "1",
        VERCEL_ENV: "preview",
        DIRECT_URL: PRODUCTION_DIRECT,
        DATABASE_URL_UNPOOLED: NEON_DIRECT,
        DATABASE_URL: NEON_POOLED,
      }),
    ).toThrow(/DIRECT_URL må ikke sættes for Preview.*DATABASE_URL_UNPOOLED/);
  });

  it("allows a Preview deployment on the integration's per-branch DATABASE_URL_UNPOOLED", () => {
    expect(() =>
      assertMigrationUrlSafe({
        VERCEL: "1",
        VERCEL_ENV: "preview",
        DATABASE_URL_UNPOOLED: NEON_DIRECT,
        DATABASE_URL: NEON_POOLED,
      }),
    ).not.toThrow();
  });

  it("refuses a pooled (-pooler) migration URL on Vercel", () => {
    // DATABASE_URL_UNPOOLED missing → falls back to the pooled DATABASE_URL.
    for (const VERCEL_ENV of ["production", "preview", "development"]) {
      expect(() =>
        assertMigrationUrlSafe({ VERCEL: "1", VERCEL_ENV, DATABASE_URL: NEON_POOLED }),
      ).toThrow(/-pooler/);
    }
    expect(() =>
      assertMigrationUrlSafe({
        VERCEL: "1",
        VERCEL_ENV: "production",
        DATABASE_URL_UNPOOLED: NEON_POOLED,
      }),
    ).toThrow(/-pooler/);
  });

  it("allows production with DIRECT_URL or DATABASE_URL_UNPOOLED on a direct host", () => {
    expect(() =>
      assertMigrationUrlSafe({
        VERCEL: "1",
        VERCEL_ENV: "production",
        DIRECT_URL: PRODUCTION_DIRECT,
        DATABASE_URL: NEON_POOLED,
      }),
    ).not.toThrow();
    expect(() =>
      assertMigrationUrlSafe({
        VERCEL: "1",
        VERCEL_ENV: "production",
        DATABASE_URL_UNPOOLED: PRODUCTION_DIRECT,
        DATABASE_URL: NEON_POOLED,
      }),
    ).not.toThrow();
  });

  it("does not throw when no URL is set (prisma generate needs none)", () => {
    expect(() => assertMigrationUrlSafe({ VERCEL: "1", VERCEL_ENV: "preview" })).not.toThrow();
  });
});
