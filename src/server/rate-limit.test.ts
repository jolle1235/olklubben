import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * rateLimit() without a database: the SQL statement is mocked, so these tests
 * cover the argument checks, the RATE_LIMIT_DISABLED switch and how the
 * returned counter is turned into a result. The SQL itself runs against
 * Postgres in tests/integration/rate-limit.itest.ts.
 */

type CounterRow = { count: number; retry_after: number };

type TaggedSql<T> = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<T>;

const queryRaw = vi.fn<TaggedSql<CounterRow[]>>(async () => []);
const executeRaw = vi.fn<TaggedSql<number>>(async () => 0);
vi.mock("@/server/db", () => ({ db: { $queryRaw: queryRaw, $executeRaw: executeRaw } }));

const envState = { isRateLimitDisabled: false };
vi.mock("@/env", () => ({
  get isRateLimitDisabled() {
    return envState.isRateLimitDisabled;
  },
}));

const { rateLimit } = await import("./rate-limit");

const OPTIONS = { limit: 3, windowSeconds: 600 };

function counterIs(count: number, retryAfter = 420): void {
  queryRaw.mockResolvedValueOnce([{ count, retry_after: retryAfter }]);
}

describe("rateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envState.isRateLimitDisabled = false;
  });

  it("tillader kald, til tælleren når grænsen", async () => {
    counterIs(1);
    expect(await rateLimit("test:key", OPTIONS)).toEqual({ ok: true });
    counterIs(3);
    expect(await rateLimit("test:key", OPTIONS)).toEqual({ ok: true });
  });

  it("afviser kaldet over grænsen med databasens ventetid", async () => {
    counterIs(4, 420);
    expect(await rateLimit("test:key", OPTIONS)).toEqual({ ok: false, retryAfterSeconds: 420 });
  });

  it("sender nøglen og vinduet som parametre til én SQL-sætning", async () => {
    counterIs(1);
    await rateLimit("join:user:abc", { limit: 10, windowSeconds: 600 });

    expect(queryRaw).toHaveBeenCalledTimes(1);
    // Tagged template: (strings, ...values). Never interpolated into the SQL text.
    const [strings, ...values] = queryRaw.mock.calls[0] ?? [];
    expect(values).toEqual(["join:user:abc", 600]);
    expect(strings?.join("?")).toContain("ON CONFLICT (key) DO UPDATE");
  });

  it("afviser ugyldige argumenter med RangeError, før databasen spørges", async () => {
    await expect(rateLimit("test:key", { limit: 0, windowSeconds: 60 })).rejects.toThrow(
      RangeError,
    );
    await expect(rateLimit("test:key", { limit: 1.5, windowSeconds: 60 })).rejects.toThrow(
      RangeError,
    );
    await expect(rateLimit("test:key", { limit: 5, windowSeconds: 2.5 })).rejects.toThrow(
      RangeError,
    );
    await expect(rateLimit("test:key", { limit: 5, windowSeconds: 0 })).rejects.toThrow(RangeError);
    await expect(rateLimit("", OPTIONS)).rejects.toThrow(RangeError);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("tillader alt uden databasekald, når rate limiting er slået fra", async () => {
    envState.isRateLimitDisabled = true;

    expect(await rateLimit("test:key", OPTIONS)).toEqual({ ok: true });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("kaster, når databasen ikke returnerer en række", async () => {
    queryRaw.mockResolvedValueOnce([]);

    await expect(rateLimit("test:key", OPTIONS)).rejects.toThrow("ingen række");
  });
});
