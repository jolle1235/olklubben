import type { Metadata } from "next";

import { FormAlert } from "@/components/features/auth/form-alert";
import { GoogleSignInButton } from "@/components/features/auth/google-sign-in";
import { ChangeEmailForm } from "@/components/features/profile/change-email-form";
import { ChangePasswordForm } from "@/components/features/profile/change-password-form";
import { LogoutButton } from "@/components/features/profile/logout-button";
import { ProfileForm } from "@/components/features/profile/profile-form";
import { ProfileIdentity } from "@/components/features/profile/profile-identity";
import { FeedbackLink, ProfileLinks } from "@/components/features/profile/profile-links";
import { GoogleReauth, SetPasswordForm } from "@/components/features/profile/set-password-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionDivider } from "@/components/ui/section-divider";
import { isGoogleConfigured } from "@/env";
import { AUTH_ERROR_MESSAGES, getOAuthErrorMessage } from "@/lib/auth-errors";
import { firstParam } from "@/lib/auth-links";
import { profileHref } from "@/lib/routes";
import { getSession, getUserClubs, requireClubPage } from "@/server/auth/session";
import { isFreshLogin } from "@/server/domain/users/login-freshness";
import { getAccountLogins } from "@/server/users/queries";

export const metadata: Metadata = { title: "Profil" };

/**
 * Profil (D-023, SPEC §8.1, §9.8, D-105, D-106, D-151, D-152): who you are
 * (with the official name when a nickname is set), name and nickname, the
 * email, the password, the way to the club page, its places and other clubs,
 * "Feedback (fejl og ønsker)" (the app-wide reports, §9.9, D-147), and log
 * out.
 *
 *   * Email: password logins get "Skift email"; Google-only accounts are told
 *     that their email follows Google.
 *   * Password: password logins get "Skift password". Google-only accounts
 *     get "Tilføj password" while their Google login is less than 10 minutes
 *     old, else the reason and "Log ind med Google igen" (isFreshLogin on the
 *     session, cached per request).
 *   * Google-login (when Google is configured, D-165): a password account
 *     without Google gets "Forbind Google" (linkSocial; Google must have the
 *     same, verified email). Google comes back with ?google=linked (shown
 *     only when the account really has Google now) or ?error=<code>.
 *
 * Each card is a region named by its heading.
 */
export default async function ProfilePage({
  params,
  searchParams,
}: PageProps<"/c/[clubId]/profile">) {
  const { clubId } = await params;
  const query = await searchParams;
  const { user, club } = await requireClubPage(clubId);
  const [clubs, logins, session] = await Promise.all([
    getUserClubs(user.id),
    getAccountLogins(user.id),
    getSession(),
  ]);
  const googleOnly = logins.hasGoogle && !logins.hasPassword;
  const freshLogin = session !== null && isFreshLogin(session.session.createdAt, new Date());
  const googleError = getOAuthErrorMessage(firstParam(query.error));
  const googleLinked = logins.hasGoogle && firstParam(query.google) === "linked";

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
          <Card role="region" aria-labelledby="profile-email-heading">
            <CardHeader>
              <h2
                id="profile-email-heading"
                className="font-heading text-xl leading-snug text-olive"
              >
                Email
              </h2>
            </CardHeader>
            <CardContent className="grid gap-6">
              {logins.hasPassword ? (
                <>
                  <p className="text-[1.05rem] text-muted-foreground">
                    Du logger ind med{" "}
                    <span className="font-semibold break-all text-ink">{user.email}</span>.
                  </p>
                  {logins.hasGoogle ? (
                    <p className="text-[0.95rem] text-muted-foreground">
                      Skifter du email, kobles dit Google-login fra. Du kan forbinde Google igen med
                      den nye email.
                    </p>
                  ) : null}
                  <ChangeEmailForm key={user.email} clubId={club.id} email={user.email} />
                </>
              ) : (
                <p className="text-[1.05rem] text-muted-foreground">
                  {AUTH_ERROR_MESSAGES.emailFollowsGoogle}
                </p>
              )}
            </CardContent>
          </Card>
        ) : null}

        {logins.hasPassword || googleOnly ? (
          <Card role="region" aria-labelledby="profile-password-heading">
            <CardHeader>
              <h2
                id="profile-password-heading"
                className="font-heading text-xl leading-snug text-olive"
              >
                {logins.hasPassword ? "Skift password" : "Tilføj password"}
              </h2>
            </CardHeader>
            <CardContent>
              {logins.hasPassword ? (
                <ChangePasswordForm clubId={club.id} email={user.email} />
              ) : freshLogin ? (
                <SetPasswordForm
                  clubId={club.id}
                  email={user.email}
                  googleAvailable={isGoogleConfigured}
                />
              ) : (
                <GoogleReauth
                  clubId={club.id}
                  email={user.email}
                  googleAvailable={isGoogleConfigured}
                />
              )}
            </CardContent>
          </Card>
        ) : null}

        {isGoogleConfigured && (logins.hasPassword || logins.hasGoogle) ? (
          <Card role="region" aria-labelledby="profile-google-heading">
            <CardHeader>
              <h2
                id="profile-google-heading"
                className="font-heading text-xl leading-snug text-olive"
              >
                Google-login
              </h2>
            </CardHeader>
            <CardContent className="grid gap-4">
              {googleLinked ? <FormAlert tone="success">Google er forbundet.</FormAlert> : null}
              {googleError ? <FormAlert>{googleError}</FormAlert> : null}
              {logins.hasGoogle ? (
                <p className="text-[1.05rem] text-muted-foreground">Du kan logge ind med Google.</p>
              ) : (
                <>
                  <p className="text-[1.05rem] text-muted-foreground">
                    Forbind din Google-konto, så kan du logge ind med ét tryk. Google-kontoen skal
                    have samme email (<span className="break-all text-ink">{user.email}</span>).
                  </p>
                  <GoogleSignInButton
                    intent="link"
                    callbackURL={`${profileHref(club.id)}?google=linked`}
                    errorCallbackURL={profileHref(club.id)}
                    loginHint={user.email}
                    className="w-full sm:w-auto sm:justify-self-start"
                  >
                    Forbind Google
                  </GoogleSignInButton>
                </>
              )}
            </CardContent>
          </Card>
        ) : null}

        <ProfileLinks clubId={club.id} clubCount={clubs.length} />
        <FeedbackLink />

        <div className="flex flex-col gap-6">
          <SectionDivider />
          <LogoutButton className="sm:self-start" />
        </div>
      </div>
    </>
  );
}
