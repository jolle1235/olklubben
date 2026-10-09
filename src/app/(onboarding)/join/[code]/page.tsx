import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CenteredShell } from "@/components/features/centered-shell";
import {
  InviteNotWorking,
  JoinConfirmation,
  LoggedOutInvite,
} from "@/components/features/clubs/join-states";
import { SignedInFooter } from "@/components/features/profile/signed-in-footer";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-message";
import { rateLimitedError } from "@/lib/action-result";
import { getSession, rememberActiveClub } from "@/server/auth/session";
import { findJoinableInvite, isClubMember } from "@/server/clubs/queries";
import { formatInviteCode, normalizeInviteCode } from "@/server/domain/clubs/invite-code";
import { memberCountLabel } from "@/server/domain/clubs/members";
import { rateLimit } from "@/server/rate-limit";

export const metadata: Metadata = { title: "Invitation" };

/**
 * Join via link (SPEC §6.5, §7.3, §10.7). Not protected by the proxy, so it
 * handles both states itself:
 *
 *   malformed code      → E18 (reveals nothing, so also when logged out)
 *   logged out          → generic invitation, signup/login with ?next= back here
 *   no active invite    → E18
 *   already a member    → straight into the club (E17)
 *   otherwise           → "Du er inviteret til <Klub> (n medlemmer)" + [ Join klub ]
 */
export default async function JoinPage({ params }: PageProps<"/join/[code]">) {
  const { code: rawCode } = await params;
  const code = normalizeInviteCode(safeDecode(rawCode));
  const session = await getSession();

  if (code === null) {
    return (
      <CenteredShell footer={session ? <SignedInFooter email={session.user.email} /> : undefined}>
        <InviteNotWorking loggedIn={session !== null} />
      </CenteredShell>
    );
  }

  if (!session) {
    return (
      <CenteredShell>
        <LoggedOutInvite code={code} displayCode={formatInviteCode(code)} />
      </CenteredShell>
    );
  }

  const { user } = session;
  // "Log ud" (e.g. on the wrong account) comes back to this invitation after the next login.
  const footer = <SignedInFooter email={user.email} next={`/join/${code}`} />;

  // Looking up a code reveals a club's name, so it is rate limited like joining (§4.7).
  const limited = await rateLimit(`join:lookup:user:${user.id}`, {
    limit: 30,
    windowSeconds: 10 * 60,
  });
  if (!limited.ok) {
    return (
      <CenteredShell title="Rolig nu 🍺" footer={footer}>
        <FormError>{rateLimitedError(limited.retryAfterSeconds).error.message}</FormError>
        <Button asChild className="mt-6 w-full">
          <Link href="/">Gå til forsiden</Link>
        </Button>
      </CenteredShell>
    );
  }

  const invite = await findJoinableInvite(code);
  if (!invite) {
    return (
      <CenteredShell footer={footer}>
        <InviteNotWorking loggedIn />
      </CenteredShell>
    );
  }

  if (await isClubMember(user.id, invite.clubId)) {
    await rememberActiveClub(user, invite.clubId);
    redirect(`/c/${invite.clubId}`);
  }

  return (
    <CenteredShell footer={footer}>
      <JoinConfirmation
        code={code}
        clubName={invite.clubName}
        memberCountText={memberCountLabel(invite.memberCount)}
      />
    </CenteredShell>
  );
}

/** "K7XM%20Q2PA" → "K7XM Q2PA". A broken escape ("%") is left as it is (→ E18), never a 500. */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
