import { describe, expect, it } from "vitest";

import { PG_UTC_OPTIONS, pgConfig } from "./pg-config";

describe("pgConfig (F-012: every connection runs in UTC)", () => {
  it("adds TimeZone=UTC to a local database", () => {
    const url = "postgresql://postgres@localhost:5432/olklubben_dev";
    expect(pgConfig(url)).toEqual({ connectionString: url, options: "-c TimeZone=UTC" });
    expect(PG_UTC_OPTIONS).toBe("-c TimeZone=UTC");
  });

  it("adds it to a direct Neon host as well", () => {
    const url =
      "postgresql://u:p@ep-cool-name-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require";
    expect(pgConfig(url)).toEqual({ connectionString: url, options: PG_UTC_OPTIONS });
  });

  it("leaves a Neon -pooler host alone (PgBouncer; Neon is already UTC)", () => {
    const url =
      "postgresql://u:p@ep-cool-name-123456-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require";
    expect(pgConfig(url)).toEqual({ connectionString: url });
  });

  it("merges an existing options parameter and strips it from the URL", () => {
    const config = pgConfig(
      "postgresql://postgres@localhost:5432/olklubben_dev?sslmode=disable&options=-c%20search_path%3Dapp",
    );
    expect(config).toEqual({
      connectionString: "postgresql://postgres@localhost:5432/olklubben_dev?sslmode=disable",
      options: "-c search_path=app -c TimeZone=UTC",
    });
  });

  it("puts UTC last, so it wins over a TimeZone in the URL", () => {
    const config = pgConfig("postgresql://localhost/db?options=-c%20TimeZone%3DEurope/Copenhagen");
    expect(config.options).toBe("-c TimeZone=Europe/Copenhagen -c TimeZone=UTC");
    expect(config.connectionString).toBe("postgresql://localhost/db");
  });

  it("handles an empty options parameter", () => {
    expect(pgConfig("postgresql://localhost/db?options=")).toEqual({
      connectionString: "postgresql://localhost/db",
      options: PG_UTC_OPTIONS,
    });
  });

  it("adds the option to a connection string that is not a URL", () => {
    expect(pgConfig("/var/run/postgresql olklubben_dev")).toEqual({
      connectionString: "/var/run/postgresql olklubben_dev",
      options: PG_UTC_OPTIONS,
    });
  });
});
