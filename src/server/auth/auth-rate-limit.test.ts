import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_ERROR_MESSAGES } from "@/lib/auth-errors";
import type { RateLimitResult } from "@/server/rate-limit";

// The hook's dependencies: rate limiting (database) and email availability (env).
const rateLimitMock = vi.fn(async (): Promise<RateLimitResult> => ({ ok: true }));
vi.mock("@/server/rate-limit", () => ({
  rateLimit: rateLimitMock,
  hashRateLimitPart: vi.fn(async (value: string) => `hash:${value}`),
}));

const emailAvailableMock = vi.fn(() => true);
vi.mock("@/server/email/send-email", () => ({
  EMAIL_DELIVERY_UNAVAILABLE: "EMAIL_DELIVERY_UNAVAILABLE",
  isEmailDeliveryAvailable: emailAvailableMock,
}));

const { assertPasswordResetDeliverable, authBeforeHook } = await import("./auth-rate-limit");
const { toAuthActionError } = await import("./errors");

function catchError(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("expected an error");
}

describe("assertPasswordResetDeliverable", () => {
  it("afviser 'Glemt password', når der ikke kan sendes email", () => {
    const error = catchError(() =>
      assertPasswordResetDeliverable("/request-password-reset", false),
    );

    expect(error).toMatchObject({
      statusCode: 400,
      body: { code: "EMAIL_DELIVERY_UNAVAILABLE" },
    });
    // The Server Action and the browser client show the "contact an admin" text.
    expect(toAuthActionError(error, "forgot-password")).toEqual({
      ok: false,
      error: { code: "EMAIL_DELIVERY_UNAVAILABLE", message: AUTH_ERROR_MESSAGES.resetUnavailable },
    });
  });

  it("lader anmodningen gå igennem, når email kan sendes", () => {
    expect(() => assertPasswordResetDeliverable("/request-password-reset", true)).not.toThrow();
  });

  it("rører ikke andre endpoints – heller ikke /reset-password (admin-linket virker uden email)", () => {
    for (const path of ["/reset-password", "/sign-in/email", "/sign-up/email", "/get-session"]) {
      expect(() => assertPasswordResetDeliverable(path, false)).not.toThrow();
    }
  });
});

describe("authBeforeHook i Better Auth", () => {
  const sendResetPassword = vi.fn(async () => {});
  const testAuth = betterAuth({
    baseURL: "http://localhost:3000",
    secret: "test-secret-test-secret-test-secret-0123",
    telemetry: { enabled: false },
    logger: { disabled: true },
    database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
    emailAndPassword: { enabled: true, sendResetPassword },
    rateLimit: { enabled: false },
    hooks: { before: authBeforeHook },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    emailAvailableMock.mockReturnValue(true);
  });

  it("afviser requestPasswordReset tidligt uden email og tæller ingen rate limit", async () => {
    emailAvailableMock.mockReturnValue(false);

    await expect(
      testAuth.api.requestPasswordReset({ body: { email: "nogen@example.test" } }),
    ).rejects.toMatchObject({ statusCode: 400, body: { code: "EMAIL_DELIVERY_UNAVAILABLE" } });
    expect(rateLimitMock).not.toHaveBeenCalled();
    expect(sendResetPassword).not.toHaveBeenCalled();
  });

  it("en rate limit giver ventetiden i minutter i formularen (429 → RATE_LIMITED)", async () => {
    rateLimitMock.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 241 });

    const error = await testAuth.api
      .signInEmail({ body: { email: "nogen@example.test", password: "forkert-password" } })
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({ statusCode: 429, body: { retryAfterSeconds: 241 } });
    expect(toAuthActionError(error, "sign-in")).toEqual({
      ok: false,
      error: { code: "RATE_LIMITED", message: "For mange forsøg. Prøv igen om 5 minutter." },
    });
  });

  describe("login-grænserne (D-028)", () => {
    const IP = "203.0.113.7";
    const ipKey = `auth:/sign-in/email:ip:${IP}`;
    const emailKey = "auth:/sign-in/email:email:hash:nogen@example.test";
    const body = { email: "nogen@example.test", password: "forkert-password" };

    it("svarer 429 med Retry-After og ventetiden, når IP-grænsen er nået", async () => {
      rateLimitMock.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 90 });

      const response = await testAuth.handler(
        new Request("http://localhost:3000/api/auth/sign-in/email", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://localhost:3000",
            "x-forwarded-for": IP,
          },
          body: JSON.stringify(body),
        }),
      );

      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("90");
      expect(await response.json()).toMatchObject({
        code: "TOO_MANY_REQUESTS",
        retryAfterSeconds: 90,
      });
      // The IP rule is checked first; once it refuses, the email rule is not counted.
      expect(rateLimitMock.mock.calls).toEqual([
        [ipKey, expect.objectContaining({ limit: 30, windowSeconds: 5 * 60 })],
      ]);
    });

    it("tæller IP og email hver for sig, og email-grænsen giver RATE_LIMITED i formularen", async () => {
      rateLimitMock
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: false, retryAfterSeconds: 90 });

      const error = await testAuth.api
        .signInEmail({ body, headers: new Headers({ "x-forwarded-for": IP }) })
        .catch((caught: unknown) => caught);

      expect(error).toMatchObject({
        statusCode: 429,
        body: { code: "TOO_MANY_REQUESTS", retryAfterSeconds: 90 },
      });
      expect(toAuthActionError(error, "sign-in")).toEqual({
        ok: false,
        error: { code: "RATE_LIMITED", message: "For mange forsøg. Prøv igen om 2 minutter." },
      });
      expect(rateLimitMock.mock.calls).toEqual([
        [ipKey, expect.objectContaining({ limit: 30, windowSeconds: 5 * 60 })],
        [emailKey, expect.objectContaining({ limit: 10, windowSeconds: 15 * 60 })],
      ]);
    });

    it("springer email-reglen over, når der ikke er nogen email i forespørgslen", async () => {
      await testAuth.api
        .signInEmail({
          body: { email: "   ", password: "forkert-password" },
          headers: new Headers({ "x-forwarded-for": IP }),
        })
        .catch(() => {});

      expect(rateLimitMock.mock.calls).toEqual([[ipKey, expect.anything()]]);
    });
  });

  it("svarer som altid (uden at afsløre emailen), når email kan sendes", async () => {
    const result = await testAuth.api.requestPasswordReset({
      body: { email: "nogen@example.test" },
    });

    expect(result).toMatchObject({ status: true });
    expect(rateLimitMock).toHaveBeenCalled();
  });
});
