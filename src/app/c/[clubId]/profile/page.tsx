import type { Metadata } from "next";

import { LogoutButton } from "@/components/features/profile/logout-button";
import { ProfileIdentity } from "@/components/features/profile/profile-identity";
import { ProfileLinks } from "@/components/features/profile/profile-links";
import { ProfileNameForm } from "@/components/features/profile/profile-name-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { RopeDivider } from "@/components/ui/rope-divider";
import { isGoogleConfigured } from "@/env";
import { getUserClubs, requireClubPage } from "@/server/auth/session";

export const metadata: Metadata = { title: "Profil" };

/**
 * Profil (D-023, SPEC §8.1, §9.8 round 1): who you are, change your name, the
 * way to the club page and other clubs, and log out.
 */
export default async function ProfilePage({ params }: PageProps<"/c/[clubId]/profile">) {
  const { clubId } = await params;
  const { user, club } = await requireClubPage(clubId);
  const clubs = await getUserClubs(user.id);

  return (
    <>
      <PageHeader title="Profil" />

      <div className="flex flex-col gap-8">
        <ProfileIdentity
          name={user.name}
          email={user.email}
          image={user.image}
          googleAvailable={isGoogleConfigured}
        />

        <Card>
          <CardHeader>
            <h2 className="font-heading text-xl leading-snug text-olive">Basisprofil</h2>
          </CardHeader>
          <CardContent>
            <ProfileNameForm name={user.name} />
          </CardContent>
        </Card>

        <ProfileLinks clubId={club.id} clubCount={clubs.length} />

        <div className="flex flex-col gap-6">
          <RopeDivider />
          <LogoutButton className="sm:self-start" />
        </div>
      </div>
    </>
  );
}
