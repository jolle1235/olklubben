import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { isProtectedPath, PROTECTED_SECTIONS, RETURN_TO_HEADER } from "./lib/protected-paths";
import { config, proxy } from "./proxy";

const ORIGIN = "http://localhost:3000";
const COOKIE = "better-auth.session_token=abc.def";

function request(
  path: string,
  init?: { method?: string; cookie?: string; headers?: Record<string, string> },
) {
  return new NextRequest(`${ORIGIN}${path}`, {
    method: init?.method ?? "GET",
    headers: { ...init?.headers, ...(init?.cookie ? { cookie: init.cookie } : {}) },
  });
}

function redirectTarget(response: Response): string | null {
  return response.headers.get("location");
}

/** The return-to header the proxy forwards to the page (NextResponse.next({ request })). */
function forwardedReturnTo(response: Response): string | null {
  return response.headers.get(`x-middleware-request-${RETURN_TO_HEADER}`);
}

/** The request header names the proxy forwards (all others are dropped upstream). */
function forwardedHeaderNames(response: Response): string[] {
  return (response.headers.get("x-middleware-override-headers") ?? "").split(",");
}

describe("isProtectedPath", () => {
  it.each([
    "/",
    "/c",
    "/c/abc",
    "/c/abc/beers",
    "/onboarding",
    "/clubs",
    "/profile",
    "/feedback",
    "/feedback/x",
    "/feedback/new",
  ])("protects %s", (path) => {
    expect(isProtectedPath(path)).toBe(true);
  });

  it.each([
    "/join/K7XMQ2PA",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/api/auth/get-session",
    "/clubsx",
    "/feedbackx",
    "/cafe",
    "/favicon.ico",
  ])("leaves %s alone", (path) => {
    expect(isProtectedPath(path)).toBe(false);
  });
});

describe("proxy", () => {
  it("sends a logged-out visitor to /login with the path and query as ?next=", () => {
    const response = proxy(request("/c/abc/beers?sort=name"));
    expect(response.status).toBe(307);
    const location = new URL(redirectTarget(response) ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/c/abc/beers?sort=name");
  });

  it("keeps the feedback form's prefill through the login (§9.9)", () => {
    const response = proxy(request("/feedback/new?type=bug&page=%2Fcalendar"));
    expect(response.status).toBe(307);
    const location = new URL(redirectTarget(response) ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/feedback/new?type=bug&page=%2Fcalendar");

    const unencoded = new URL(
      redirectTarget(proxy(request("/feedback/new?type=bug&page=/calendar"))) ?? "",
    );
    expect(unencoded.searchParams.get("next")).toBe("/feedback/new?type=bug&page=/calendar");
  });

  it("matches /feedback in the proxy config (mirrors PROTECTED_SECTIONS)", () => {
    expect(config.matcher).toContain("/feedback/:path*");
    for (const section of PROTECTED_SECTIONS) {
      expect(config.matcher).toContain(`${section}/:path*`);
    }
  });

  it("sends / to /login without ?next=", () => {
    expect(redirectTarget(proxy(request("/")))).toBe(`${ORIGIN}/login`);
  });

  it("lets a request with a session cookie through (the page checks it for real)", () => {
    const response = proxy(request("/c/abc", { cookie: "better-auth.session_token=abc.def" }));
    expect(redirectTarget(response)).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("accepts the __Secure- cookie used on https", () => {
    const response = proxy(
      request("/clubs", { cookie: "__Secure-better-auth.session_token=abc.def" }),
    );
    expect(redirectTarget(response)).toBeNull();
  });

  it("never redirects the join page or server action POSTs", () => {
    expect(redirectTarget(proxy(request("/join/K7XMQ2PA")))).toBeNull();
    expect(redirectTarget(proxy(request("/c/abc", { method: "POST" })))).toBeNull();
  });
});

describe("proxy: return path for a stale cookie (RETURN_TO_HEADER)", () => {
  it("forwards path and query for a protected GET with a cookie", () => {
    const response = proxy(request("/c/abc/club?tab=members", { cookie: COOKIE }));
    expect(redirectTarget(response)).toBeNull();
    expect(forwardedReturnTo(response)).toBe("/c/abc/club?tab=members");
    expect(forwardedHeaderNames(response)).toContain("cookie");
  });

  it("also for HEAD", () => {
    const response = proxy(request("/profile", { method: "HEAD", cookie: COOKIE }));
    expect(forwardedReturnTo(response)).toBe("/profile");
  });

  it("replaces a spoofed header with the real path", () => {
    const response = proxy(
      request("/c/abc", { cookie: COOKIE, headers: { [RETURN_TO_HEADER]: "//evil.example" } }),
    );
    expect(forwardedReturnTo(response)).toBe("/c/abc");
  });

  it("strips a spoofed header everywhere it does not set one", () => {
    const spoofed = { [RETURN_TO_HEADER]: "/c/other" };
    for (const response of [
      proxy(request("/", { cookie: COOKIE, headers: spoofed })),
      proxy(request("/c/abc", { method: "POST", cookie: COOKIE, headers: spoofed })),
      proxy(request("/join/K7XMQ2PA", { headers: spoofed })),
    ]) {
      expect(forwardedReturnTo(response)).toBeNull();
      expect(forwardedHeaderNames(response)).not.toContain(RETURN_TO_HEADER);
      expect(response.headers.get("x-middleware-next")).toBe("1");
    }
  });

  it("drops Next's _rsc cache-busting parameter", () => {
    const response = proxy(request("/c/abc/club?_rsc=1x2y3&tab=members", { cookie: COOKIE }));
    expect(forwardedReturnTo(response)).toBe("/c/abc/club?tab=members");
    expect(forwardedReturnTo(proxy(request("/c/abc?_rsc=1x2y3", { cookie: COOKIE })))).toBe(
      "/c/abc",
    );
  });

  it("sets nothing for / (home routing needs no deep link)", () => {
    const response = proxy(request("/", { cookie: COOKIE }));
    expect(redirectTarget(response)).toBeNull();
    expect(forwardedReturnTo(response)).toBeNull();
  });

  it("lets a POST through without it", () => {
    const response = proxy(request("/c/abc/club", { method: "POST", cookie: COOKIE }));
    expect(redirectTarget(response)).toBeNull();
    expect(forwardedReturnTo(response)).toBeNull();
  });
});
