import { env } from "@/env";
import { isCronAuthorized } from "@/server/cron/auth";
import { closeAllDuePolls } from "@/server/polls/close";
import { revalidateClub } from "@/server/revalidate";

/**
 * The daily safety net for polls (SPEC §4.8, §9.7.5, D-131): Vercel Cron
 * calls GET /api/cron/close-polls at 04:00 UTC (vercel.json) with
 * "Authorization: Bearer <CRON_SECRET>". It closes every OPEN poll whose
 * deadline has passed or whose current members have all voted (the lazy
 * close on Overblik, Kalender and the poll page is the primary mechanism),
 * and revalidates the clubs it touched.
 *
 *   CRON_SECRET unset   → 503 {"error":"CRON_SECRET mangler"} (switched off)
 *   missing/wrong token → 401 {"error":"Ikke autoriseret"}
 *   otherwise           → 200 { clubs, closed, awaiting, failed }
 *
 * /api is outside the proxy matcher (src/proxy.ts): no session involved.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  const secret = env.CRON_SECRET;
  if (!secret) {
    console.error("[cron] close-polls: CRON_SECRET mangler – den daglige lukning er slået fra.");
    return Response.json({ error: "CRON_SECRET mangler" }, { status: 503 });
  }
  if (!isCronAuthorized(request.headers.get("authorization"), secret)) {
    return Response.json({ error: "Ikke autoriseret" }, { status: 401 });
  }

  const result = await closeAllDuePolls(new Date());
  for (const clubId of result.touchedClubIds) revalidateClub(clubId);
  return Response.json({
    clubs: result.clubs,
    closed: result.closed,
    awaiting: result.awaiting,
    failed: result.failed,
  });
}
