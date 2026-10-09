import { getSession } from "@/server/auth/session";
import { isSessionRefreshDue } from "@/server/auth/session-refresh";

import { SessionKeepAlive } from "./session-keep-alive";

/**
 * Server Component: renders <SessionKeepAlive /> only when the session is due
 * for its daily refresh (D-030), so most page loads make no extra request.
 * Uses the per-request cached getSession(). Rendered in the club layout and in
 * SignedInFooter (onboarding, /clubs, logged-in /join pages).
 */
export async function SessionRefresh() {
  const session = await getSession();
  if (!session || !isSessionRefreshDue(session.session.expiresAt)) return null;
  return <SessionKeepAlive />;
}
