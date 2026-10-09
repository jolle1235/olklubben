import type { Metadata } from "next";

import { ChangePasswordForm } from "@/components/features/profile/change-password-form";
import { LogoutButton } from "@/components/features/profile/logout-button";
import { ProfileForm } from "@/components/features/profile/profile-form";
import { ProfileIdentity } from "@/components/features/profile/profile-identity";
import { ProfileLinks } from "@/components/features/profile/profile-links";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { RopeDivider } from "@/components/ui/rope-divider";
import { isGoogleConfigured } from "@/env";
import { getUserClubs, requireClubPage } from "@/server/auth/session";
import { getAccountLogins } from "@/server/users/queries";

export const metadata: Metadata = { title: "Profil" };

/**
 * Profil (D-023, SPEC §8.1, §9.8, D-105, D-106): who you are (with the
 * official name when a nickname is set), name and nickname, "Skift password"
 * for password logins (Google-only accounts get a note instead), the way to
 * the club page, its places and other clubs, and log out. No email change
 * yet (D-106).
 */
export default async function ProfilePage({ params }: PageProps<"/c/[clubId]/profile">) {
  const { clubId } = await params;
  const { user, club } = await requireClubPage(clubId);
  const [clubs, logins] = await Promise.all([getUserClubs(user.id), getAccountLogins(user.id)]);

  return (
    <>
      <PageHeader title="Profil" />

      <div className="flex flex-col gap-8">
        <ProfileIdentity
          name={user.name}
          nickname={user.nickname}
          email={user.email}
          image={user.image}
          googleAvailable={isGoogleConfigured}
        />

        <Card>
          <CardHeader>
            <h2 className="font-heading text-xl leading-snug text-olive">Navn og kælenavn</h2>
          </CardHeader>
          <CardContent>
            <ProfileForm
              key={JSON.stringify([user.name, user.nickname])}
              clubId={club.id}
              name={user.name}
              nickname={user.nickname}
            />
          </CardContent>
        </Card>

        {logins.hasPassword || logins.hasGoogle ? (
          <Card>
            <CardHeader>
              <h2 className="font-heading text-xl leading-snug text-olive">
                {logins.hasPassword ? "Skift password" : "Password"}
              </h2>
            </CardHeader>
            <CardContent>
              {logins.hasPassword ? (
                <ChangePasswordForm clubId={club.id} email={user.email} />
              ) : (
                <p className="text-[1.05rem] text-muted-foreground">
                  Du logger ind med Google, så du har ikke brug for et password.
                </p>
              )}
            </CardContent>
          </Card>
        ) : null}

        <ProfileLinks clubId={club.id} clubCount={clubs.length} />

        <div className="flex flex-col gap-6">
          <RopeDivider />
          <LogoutButton className="sm:self-start" />
        </div>
      </div>
    </>
  );
}
