import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { CenteredShell } from "@/components/features/centered-shell";
import { CreateClubForm } from "@/components/features/clubs/create-club-form";
import { JoinCodeForm } from "@/components/features/clubs/join-code-form";
import { SignedInFooter } from "@/components/features/profile/signed-in-footer";
import { getUserClubs, requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Kom i gang" };

/**
 * Onboarding (SPEC §7.2, §10.2): create a club or join one with a code, on one
 * screen. Also reached from the ClubSwitcher ("Opret eller join ny klub") by
 * users who already have clubs; they get a way back.
 */
export default async function OnboardingPage() {
  const user = await requireUser({ returnTo: "/onboarding" });
  const clubs = await getUserClubs(user.id);
  const [onlyClub] = clubs;
  const hasClubs = onlyClub !== undefined;

  const backLink =
    clubs.length === 1 && onlyClub
      ? { href: `/c/${onlyClub.id}`, label: `Tilbage til ${onlyClub.name}` }
      : { href: "/clubs", label: "Tilbage til dine klubber" };

  return (
    <CenteredShell
      title={hasClubs ? "Opret eller join en ny klub" : "Velkommen ombord! 🍺"}
      subtitle={
        hasClubs
          ? "Start en ny ølklub, eller join en med en invitationskode."
          : "Du er ikke medlem af nogen klub endnu."
      }
      footer={
        <div className="grid justify-items-center gap-2">
          {hasClubs ? (
            <Link
              href={backLink.href}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 font-semibold text-olive underline-offset-4 hover:underline"
            >
              <ArrowLeftIcon aria-hidden className="size-4" />
              {backLink.label}
            </Link>
          ) : null}
          <SignedInFooter email={user.email} />
        </div>
      }
    >
      <section aria-labelledby="create-club-heading">
        <h2 id="create-club-heading" className="mb-1 text-xl text-olive">
          Opret ølklub
        </h2>
        <p className="mb-4 text-[0.95rem] text-muted-foreground">
          Du bliver klubbens admin og får et link, du kan dele med de andre.
        </p>
        <CreateClubForm />
      </section>

      <div className="my-7 flex items-center gap-4" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        <span className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          eller
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <section aria-labelledby="join-club-heading">
        <h2 id="join-club-heading" className="mb-1 text-xl text-olive">
          Join en ølklub
        </h2>
        <p className="mb-4 text-[0.95rem] text-muted-foreground">
          Har du fået en kode af en ven? Skriv den her.
        </p>
        <JoinCodeForm />
      </section>
    </CenteredShell>
  );
}
