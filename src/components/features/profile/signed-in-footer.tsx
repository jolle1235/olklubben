import { SessionRefresh } from "@/components/features/auth/session-refresh";

import { LogoutButton } from "./logout-button";

/**
 * "Logget ind som <email>. Log ud" under the card on pages outside a club
 * (onboarding, the club picker, invitations). Without it a user with no club
 * – or on the wrong account on a shared phone – could not log out, because
 * "Log ud" otherwise lives on the club's Profil tab.
 *
 * `next` is passed on to "Log ud", so logging in again comes back to it (the
 * invitation on /join/<code>).
 *
 * Also slides the session forward on these pages (<SessionRefresh />, D-030).
 * Server Component: do not import it from a client component.
 */
export function SignedInFooter({ email, next }: { email: string; next?: string | null }) {
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-2">
      <span className="min-w-0">
        Logget ind som <span className="font-semibold break-all text-ink">{email}</span>.
      </span>
      <LogoutButton variant="link" next={next} />
      <SessionRefresh />
    </p>
  );
}
