import type { Metadata } from "next";

import { FormAlert } from "@/components/features/auth/form-alert";
import { ExternalSignInButton } from "@/components/features/auth/external-sign-in";
import { ChangeEmailForm } from "@/components/features/profile/change-email-form";
import { ChangePasswordForm } from "@/components/features/profile/change-password-form";
import { LogoutButton } from "@/components/features/profile/logout-button";
import { ProfileForm } from "@/components/features/profile/profile-form";
import { ProfileIdentity } from "@/components/features/profile/profile-identity";
import { FeedbackLink, ProfileLinks } from "@/components/features/profile/profile-links";
import { ExternalReauth, SetPasswordForm } from "@/components/features/profile/set-password-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionDivider } from "@/components/ui/section-divider";
import { externalProvider } from "@/env";
import { emailFollowsExternal, getOAuthErrorMessage } from "@/lib/auth-errors";
import { firstParam } from "@/lib/auth-links";
import { EXTERNAL_PROVIDERS } from "@/lib/auth-providers";
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
 *   * Email: password logins get "Skift email"; accounts with only an external
 *     login (Google or Auth0, D-166) are told that their email follows it.
 *   * Password: password logins get "Skift password". Accounts with only an
 *     external login get "Tilføj password" while that login is less than 10
 *     minutes old, else the reason and "Log ind med … igen" (isFreshLogin on
 *     the session, cached per request; the action also checks Auth0's
 *     auth_time).
 *   * "{label}-login" (the configured external login, D-165, D-166): a
 *     password account without it gets "Forbind …" (linkSocial; the external
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
  // The account's own external login (for "Tilføj password" and the email text).
  const accountProvider = logins.external[0];
  const externalOnly = accountProvider !== undefined && !logins.hasPassword;
  const freshLogin = session !== null && isFreshLogin(session.session.createdAt, new Date());
  // The configured external login (the "Forbind …" card).
  const configured = externalProvider ? EXTERNAL_PROVIDERS[externalProvider] : null;
  const hasConfigured = externalProvider !== null && logins.external.includes(externalProvider);
  const externalError = configured
    ? getOAuthErrorMessage(firstParam(query.error), configured.label)
    : null;
  const externalLinked = hasConfigured && firstParam(query.external) === "linked";

  return (
    <>
      <PageHeader title="Profil" />

      <div className="flex flex-col gap-8">
        <ProfileIdentity
          name={user.name}
          nickname={user.nickname}
          email={user.email}
          image={user.image}
          googleAvailable={externalProvider !== null}
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

        {logins.hasPassword || accountProvider ? (
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
                  {accountProvider ? (
                    <p className="text-[0.95rem] text-muted-foreground">
                      Skifter du email, kobles dit {EXTERNAL_PROVIDERS[accountProvider].label}-login
                      fra. Du kan forbinde det igen med den nye email.
                    </p>
                  ) : null}
                  <ChangeEmailForm key={user.email} clubId={club.id} email={user.email} />
                </>
              ) : (
                <p className="text-[1.05rem] text-muted-foreground">
                  {emailFollowsExternal(EXTERNAL_PROVIDERS[accountProvider ?? "google"].label)}
                </p>
              )}
            </CardContent>
          </Card>
        ) : null}

        {logins.hasPassword || externalOnly ? (
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
              ) : accountProvider === undefined ? null : freshLogin ? (
                <SetPasswordForm
                  clubId={club.id}
                  email={user.email}
                  provider={accountProvider}
                  available={accountProvider === externalProvider}
                />
              ) : (
                <ExternalReauth
                  clubId={club.id}
                  email={user.email}
                  provider={accountProvider}
                  available={accountProvider === externalProvider}
                />
              )}
            </CardContent>
          </Card>
        ) : null}

        {externalProvider && configured && (logins.hasPassword || hasConfigured) ? (
          <Card role="region" aria-labelledby="profile-external-heading">
            <CardHeader>
              <h2
                id="profile-external-heading"
                className="font-heading text-xl leading-snug text-olive"
              >
                {configured.label}-login
              </h2>
            </CardHeader>
            <CardContent className="grid gap-4">
              {externalLinked ? (
                <FormAlert tone="success">{configured.label} er forbundet.</FormAlert>
              ) : null}
              {externalError ? <FormAlert>{externalError}</FormAlert> : null}
              {hasConfigured ? (
                <p className="text-[1.05rem] text-muted-foreground">
                  Du kan logge ind med {configured.label}.
                </p>
              ) : (
                <>
                  <p className="text-[1.05rem] text-muted-foreground">
                    Forbind din {configured.label}-konto, så kan du logge ind med ét tryk.{" "}
                    {configured.label}-kontoen skal have samme email (
                    <span className="break-all text-ink">{user.email}</span>).
                  </p>
                  <ExternalSignInButton
                    provider={externalProvider}
                    intent="link"
                    callbackURL={`${profileHref(club.id)}?external=linked`}
                    errorCallbackURL={profileHref(club.id)}
                    loginHint={user.email}
                    className="w-full sm:w-auto sm:justify-self-start"
                  >
                    {configured.link}
                  </ExternalSignInButton>
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
