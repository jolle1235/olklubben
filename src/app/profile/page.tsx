import { redirect } from "next/navigation";

import { getUserClubs, requireUser } from "@/server/auth/session";
import { resolveProfilePath } from "@/server/domain/routing";

/**
 * /profile → the Profil tab of the active club (D-023, SPEC §8.2). Profil is
 * club-scoped so the AppShell stays; this route keeps old links working.
 */
export default async function ProfileRedirectPage() {
  const user = await requireUser({ returnTo: "/profile" });
  const clubs = await getUserClubs(user.id);

  redirect(
    resolveProfilePath({
      clubIds: clubs.map((club) => club.id),
      lastActiveClubId: user.lastActiveClubId,
    }),
  );
}
