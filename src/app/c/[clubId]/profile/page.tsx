import type { Metadata } from "next";

import { FormAlert } from "@/components/features/auth/form-alert";
import { GoogleSignInButton } from "@/components/features/auth/google-sign-in";
import { AppearanceControl } from "@/components/features/profile/appearance-control";
import { ChangeEmailForm } from "@/components/features/profile/change-email-form";
import { ChangePasswordForm } from "@/components/features/profile/change-password-form";
import { LogoutButton } from "@/components/features/profile/logout-button";
import { ProfileForm } from "@/components/features/profile/profile-form";
import { ProfileIdentity } from "@/components/features/profile/profile-identity";
import { FeedbackLink, ProfileLinks } from "@/components/features/profile/profile-links";
import { ProfileSection } from "@/components/features/profile/profile-section";
import { GoogleReauth, SetPasswordForm } from "@/components/features/profile/set-password-form";
import { PageHeader } from "@/components/ui/page-header";
import { SectionDivider } from "@/components/ui/section-divider";
import { isGoogleConfigured } from "@/env";
import { EMAIL_FOLLOWS_GOOGLE, getOAuthErrorMessage } from "@/lib/auth-errors";
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
 * "Udseende" (per device, §13.2), "Feedback (fejl og ønsker)" (the app-wide
 * reports, §9.9, D-147), and log out.
 *
 *   * Email: password logins get "Skift email"; accounts with only a Google
 *     login are told that their email follows it.
 *   * Password: password logins get "Skift password". Accounts with only a
 *     Google login get "Tilføj password" while that login is less than 10
 *     minutes old, else the reason and "Log ind med Google igen" (isFreshLogin
 *     on the session, cached per request; the action checks again, D-152).
 *   * "Google-login" (only when Google is configured, D-165, D-178): a
 *     password account without it gets "Forbind Google" (linkSocial; the Google
 *     account must have the same, verified email). It comes back with
 *     ?external=linked (shown only when the account really has it now) or
 *     ?error=<code>.
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
  const hasLogin = logins.hasPassword || logins.hasGoogle;
  const freshLogin = session !== null && isFreshLogin(session.session.createdAt, new Date());
  // "Forbind Google" lands here with ?external=linked, or ?error=<code> when it failed.
  const googleError = getOAuthErrorMessage(firstParam(query.error));
  const googleLinked = logins.hasGoogle && firstParam(query.external) === "linked";

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

        <ProfileSection title="Navn og kælenavn">
          <ProfileForm
            key={JSON.stringify([user.name, user.nickname])}
            clubId={club.id}
            name={user.name}
            nickname={user.nickname}
          />
        </ProfileSection>

        {hasLogin ? (
          <ProfileSection
            title="Email"
            headingId="profile-email-heading"
            contentClassName="grid gap-6"
          >
            {logins.hasPassword ? (
              <>
                <p className="text-lead text-muted-foreground">
                  Du logger ind med{" "}
                  <span className="font-semibold break-all text-foreground">{user.email}</span>.
                </p>
                {logins.hasGoogle ? (
                  <p className="text-body-sm text-muted-foreground">
                    Skifter du email, kobles dit Google-login fra. Du kan forbinde det igen med den
                    nye email.
                  </p>
                ) : null}
                <ChangeEmailForm key={user.email} clubId={club.id} email={user.email} />
              </>
            ) : (
              <p className="text-lead text-muted-foreground">{EMAIL_FOLLOWS_GOOGLE}</p>
            )}
          </ProfileSection>
        ) : null}

        {hasLogin ? (
          <ProfileSection
            title={logins.hasPassword ? "Skift password" : "Tilføj password"}
            headingId="profile-password-heading"
          >
            {logins.hasPassword ? (
              <ChangePasswordForm clubId={club.id} email={user.email} />
            ) : freshLogin ? (
              <SetPasswordForm clubId={club.id} email={user.email} available={isGoogleConfigured} />
            ) : (
              <GoogleReauth clubId={club.id} email={user.email} available={isGoogleConfigured} />
            )}
          </ProfileSection>
        ) : null}

        {isGoogleConfigured && hasLogin ? (
          <ProfileSection
            title="Google-login"
            headingId="profile-google-heading"
            contentClassName="grid gap-4"
          >
            {googleLinked ? <FormAlert tone="success">Google er forbundet.</FormAlert> : null}
            {googleError ? <FormAlert>{googleError}</FormAlert> : null}
            {logins.hasGoogle ? (
              <p className="text-lead text-muted-foreground">Du kan logge ind med Google.</p>
            ) : (
              <>
                <p className="text-lead text-muted-foreground">
                  Forbind din Google-konto, så kan du logge ind med ét tryk. Google-kontoen skal
                  have samme email (<span className="break-all text-foreground">{user.email}</span>
                  ).
                </p>
                <GoogleSignInButton
                  intent="link"
                  callbackURL={`${profileHref(club.id)}?external=linked`}
                  errorCallbackURL={profileHref(club.id)}
                  loginHint={user.email}
                  className="w-full sm:w-auto sm:justify-self-start"
                >
                  Forbind Google
                </GoogleSignInButton>
              </>
            )}
          </ProfileSection>
        ) : null}

        <ProfileSection
          title="Udseende"
          headingId="profile-appearance-heading"
          contentClassName="grid gap-4"
        >
          <p className="text-lead text-muted-foreground">
            System følger din telefon eller computer. Valget gælder kun på denne enhed.
          </p>
          <AppearanceControl />
        </ProfileSection>

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
