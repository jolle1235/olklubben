import { describe, expect, it } from "vitest";

import { assertSeedTarget, seedTargetHost } from "./seed-target";

const LOCAL = "postgresql://postgres@localhost:5432/olklubben_dev";
const NEON = "postgresql://u:p@ep-cool-name-123456.eu-central-1.aws.neon.tech/neondb";

describe("assertSeedTarget (prisma/seed.ts)", () => {
  it("allows local databases", () => {
    for (const url of [
      LOCAL,
      "postgresql://postgres@127.0.0.1/olklubben_dev",
      "postgresql://postgres@[::1]:5432/olklubben_dev",
      "postgresql:///olklubben_dev",
      "postgresql://postgres@localhost/olklubben_dev?host=/var/run/postgresql",
    ]) {
      expect(() => assertSeedTarget(url, {})).not.toThrow();
    }
  });

  it("refuses a remote host and names it and the flag", () => {
    expect(() => assertSeedTarget(NEON, {})).toThrow(
      /ep-cool-name-123456\.eu-central-1\.aws\.neon\.tech.*SEED_ALLOW_REMOTE=1/,
    );
    // pg connects to the host query parameter, not the URL's host.
    expect(() =>
      assertSeedTarget("postgresql://u@localhost/db?host=db.example.invalid", {}),
    ).toThrow(/db\.example\.invalid/);
    // An empty host falls back to PGHOST, like node-postgres.
    expect(() => assertSeedTarget("postgresql:///db", { PGHOST: "db.example.invalid" })).toThrow(
      /db\.example\.invalid/,
    );
  });

  it("allows a remote host with SEED_ALLOW_REMOTE=1", () => {
    expect(() => assertSeedTarget(NEON, { SEED_ALLOW_REMOTE: "1" })).not.toThrow();
    expect(() => assertSeedTarget(NEON, { SEED_ALLOW_REMOTE: "true" })).toThrow();
  });

  it("always refuses production, even locally or with the flag", () => {
    expect(() => assertSeedTarget(LOCAL, { NODE_ENV: "production" })).toThrow(/produktion/);
    expect(() =>
      assertSeedTarget(NEON, { VERCEL_ENV: "production", SEED_ALLOW_REMOTE: "1" }),
    ).toThrow(/produktion/);
  });

  it("never echoes the password of the connection string", () => {
    expect(() => assertSeedTarget(NEON, {})).toThrow(/^(?!.*u:p@)/s);
    expect(seedTargetHost("not a url", {})).toBe("(ugyldig DATABASE_URL)");
  });
});
