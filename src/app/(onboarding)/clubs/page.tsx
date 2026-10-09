import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PlusIcon } from "lucide-react";

import { CenteredShell } from "@/components/features/centered-shell";
import { ClubPickerList } from "@/components/features/clubs/club-picker-list";
import { SignedInFooter } from "@/components/features/profile/signed-in-footer";
import { Button } from "@/components/ui/button";
import { getUserClubs, requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Vælg klub" };

/**
 * Klubvælger (SPEC §10.1, §10.3): where "/" sends a user with several clubs
 * when the last active club is unknown or gone (E15). No clubs → onboarding.
 */
export default async function ClubsPage() {
  const user = await requireUser({ returnTo: "/clubs" });
  const clubs = await getUserClubs(user.id);
  if (clubs.length === 0) redirect("/onboarding");

  return (
    <CenteredShell
      title="Vælg klub"
      subtitle="Hvilken klub skal vi kigge forbi i dag?"
      footer={<SignedInFooter email={user.email} />}
    >
      <ClubPickerList clubs={clubs} />
      <Button asChild variant="outline" className="mt-6 w-full">
        <Link href="/onboarding">
          <PlusIcon aria-hidden />
          Opret eller join ny klub
        </Link>
      </Button>
    </CenteredShell>
  );
}
