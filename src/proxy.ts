import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import { isProtectedPath, RETURN_TO_HEADER } from "@/lib/protected-paths";

/**
 * Optimistic login redirect (Next.js 16 Proxy, formerly middleware).
 *
 * Only checks whether a Better Auth session cookie is present – not whether
 * the session is valid. Real authentication and authorization happen in
 * server code (requireUser/requireMembership, SPEC §4.3–4.4) on every request.
 *
 * Protected app paths without a cookie go to /login?next=<path+search>.
 * Never touched: /join/* (the join page handles logged-out users itself),
 * /login, /signup, /forgot-password, /reset-password, /api/*, static files.
 * Logged-in users on /login or /signup are left to the pages. Only GET/HEAD
 * navigations are redirected; Server Action POSTs pass through and are checked
 * by the action itself.
 *
 * With a cookie, a protected GET/HEAD (other than "/") is forwarded with the
 * path + query in RETURN_TO_HEADER. If the cookie is stale, requireUser()
 * redirects to /login?next=<that path>, so the deep link survives. Any
 * incoming copy of the header is always stripped, so clients cannot set it.
 */

export function proxy(request: NextRequest): NextResponse {
  const headers = new Headers(request.headers);
  headers.delete(RETURN_TO_HEADER);
  const forward = () => NextResponse.next({ request: { headers } });

  if (request.method !== "GET" && request.method !== "HEAD") return forward();

  const { pathname, search } = request.nextUrl;
  if (!isProtectedPath(pathname)) return forward();

  if (!getSessionCookie(request)) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname !== "/") {
    // Next normally strips _rsc from nextUrl already; never let it into ?next=.
    const url = request.nextUrl.clone();
    url.searchParams.delete("_rsc");
    headers.set(RETURN_TO_HEADER, `${url.pathname}${url.search}`);
  }
  return forward();
}

export const config = {
  // Must mirror PROTECTED_SECTIONS in src/lib/protected-paths.ts (matchers have
  // to be literals). Add new top-level app routes in both places.
  matcher: [
    "/",
    "/c/:path*",
    "/onboarding/:path*",
    "/clubs/:path*",
    "/profile/:path*",
    "/feedback/:path*",
  ],
};
