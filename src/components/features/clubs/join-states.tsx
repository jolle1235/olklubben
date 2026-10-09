import Link from "next/link";
import { TicketXIcon } from "lucide-react";

import { ClubBadge } from "@/components/features/club-badge";
import { Button } from "@/components/ui/button";
import { withNext } from "@/lib/auth-links";

import { JoinClubForm } from "./join-club-form";

/**
 * The bodies of /join/<code> (SPEC §6.5, §10.7, E18). Rendered inside a
 * CenteredShell card, each with the page's only <h1>.
 */

const headingClass = "text-[1.85rem] leading-tight font-bold tracking-tight text-olive";

/** E18: unknown, malformed, revoked or expired code. */
export function InviteNotWorking({ loggedIn }: { loggedIn: boolean }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div
        aria-hidden
        className="mb-5 grid size-16 place-items-center porthole rounded-full bg-cream-deep text-olive"
      >
        <TicketXIcon className="size-7" />
      </div>
      <h1 className={headingClass}>Koden virker ikke længere</h1>
      <p className="mt-2 text-[1.05rem] text-muted-foreground">
        Spørg efter et nyt link. Måske har en admin lavet en ny kode.
      </p>
      <div className="mt-7 grid w-full gap-3">
        {loggedIn ? (
          <Button asChild>
            <Link href="/onboarding">Skriv en anden kode</Link>
          </Button>
        ) : null}
        <Button asChild variant={loggedIn ? "outline" : "default"}>
          <Link href="/">Gå til forsiden</Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * Logged out (SPEC §6.5): the club is not named before login, so a code never
 * reveals anything to strangers. Both buttons come back here after login.
 */
export function LoggedOutInvite({ code, displayCode }: { code: string; displayCode: string }) {
  const next = `/join/${code}`;
  return (
    <div className="flex flex-col items-center text-center">
      <p
        aria-hidden
        className="mb-5 grid size-16 place-items-center porthole rounded-full bg-amber-tint text-3xl"
      >
        🍺
      </p>
      <h1 className={headingClass}>Du er inviteret til en ølklub 🍺</h1>
      <p className="mt-2 text-[1.05rem] text-muted-foreground">
        Opret en konto eller log ind, så viser vi dig klubben, og du kan joine med det samme.
      </p>
      <p className="mt-4 rounded-lg bg-cream-deep px-3 py-1.5 text-[0.95rem] text-ink">
        Invitationskode{" "}
        <span className="font-display font-bold tracking-wider text-olive">{displayCode}</span>
      </p>
      <div className="mt-7 grid w-full gap-3">
        <Button asChild size="lg">
          <Link href={withNext("/signup", next)}>Opret konto</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href={withNext("/login", next)}>Log ind</Link>
        </Button>
      </div>
    </div>
  );
}

/** Logged in with a working code (SPEC §10.7): "Du er inviteret til <Klub> (n medlemmer)". */
export function JoinConfirmation({
  code,
  clubName,
  memberCountText,
}: {
  code: string;
  clubName: string;
  memberCountText: string;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <ClubBadge name={clubName} size="lg" className="mb-5" />
      <h1 className="text-olive">
        <span className="block text-[1.05rem] font-semibold text-muted-foreground">
          Du er inviteret til
        </span>
        <span className="mt-1 block text-[2rem] leading-tight font-bold tracking-tight break-words">
          {clubName}
        </span>
      </h1>
      <p className="mt-2 text-[1.05rem] text-muted-foreground">({memberCountText})</p>
      <div className="mt-7 grid w-full gap-3">
        <JoinClubForm code={code} />
        <Button asChild variant="ghost">
          <Link href="/">Ikke nu</Link>
        </Button>
      </div>
    </div>
  );
}
