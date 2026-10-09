import { redirect } from "next/navigation";

import { getHomePath, getSession } from "@/server/auth/session";

/**
 * "/" has no page of its own: it sends the user on (SPEC §10.1, E15).
 *   logged out → /login
 *   0 clubs    → /onboarding
 *   1 club     → /c/<clubId>
 *   2+ clubs   → the last active club, or /clubs when that is gone
 */
export default async function Home(): Promise<never> {
  const session = await getSession();
  if (!session) redirect("/login");
  redirect(await getHomePath(session.user));
}
