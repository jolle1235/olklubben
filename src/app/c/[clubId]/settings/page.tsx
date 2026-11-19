import type { Metadata } from "next";
import { MapPinIcon, MessageSquareWarningIcon, UsersIcon } from "lucide-react";

import { AppearanceControl } from "@/components/features/profile/appearance-control";
import { LogoutButton } from "@/components/features/profile/logout-button";
import {
  AccountRow,
  MyClubsRows,
  SettingsGroup,
  SettingsItem,
  SettingsLink,
  SETTINGS_ROW,
} from "@/components/features/profile/settings-lists";
import { placeCountLabel } from "@/components/features/clubs/club-labels";
import { PageHeader } from "@/components/ui/page-header";
import { getDisplayName } from "@/lib/format/display-name";
import { clubHref, feedbackListHref, placesHref, profileHref } from "@/lib/routes";
import { getUserClubs, requireClubPage } from "@/server/auth/session";
import { countActivePlaces } from "@/server/clubs/queries";
import { memberCountLabel } from "@/server/domain/clubs/members";

export const metadata: Metadata = { title: "Indstillinger" };

/**
 * Indstillinger (D-183, SPEC §8.1, §9.8): the account (→ Konto), the club
 * (Klubben, Steder), my clubs (switch club, create or join one) and the app
 * (Udseende, Feedback, Log ud). Clubs are switched here on mobile.
 */
export default async function SettingsPage({ params }: PageProps<"/c/[clubId]/settings">) {
  const { clubId } = await params;
  const { user, club } = await requireClubPage(clubId);
  const [clubs, placeCount] = await Promise.all([
    getUserClubs(user.id),
    countActivePlaces(club.id),
  ]);
  const memberCount = clubs.find((item) => item.id === club.id)?.memberCount ?? 0;

  return (
    <>
      <PageHeader title="Indstillinger" />

      <div className="flex flex-col gap-section">
        <SettingsGroup id="settings-account" title="Konto">
          <AccountRow
            href={profileHref(club.id)}
            name={getDisplayName(user)}
            email={user.email}
            image={user.image}
          />
        </SettingsGroup>

        <SettingsGroup id="settings-club" title={club.name}>
          <SettingsLink
            href={clubHref(club.id)}
            icon={UsersIcon}
            title="Medlemmer og invitation"
            subtitle={memberCountLabel(memberCount)}
          />
          <SettingsLink
            href={placesHref(club.id)}
            icon={MapPinIcon}
            title="Steder"
            subtitle={placeCountLabel(placeCount)}
          />
        </SettingsGroup>

        <SettingsGroup id="settings-clubs" title="Mine klubber">
          <MyClubsRows clubs={clubs} activeId={club.id} />
        </SettingsGroup>

        <SettingsGroup id="settings-app" title="App">
          <SettingsItem>
            <AppearanceControl />
          </SettingsItem>
          <SettingsLink
            href={feedbackListHref()}
            icon={MessageSquareWarningIcon}
            title="Feedback (fejl og ønsker)"
            subtitle="Rapportér en fejl eller foreslå en idé"
          />
          <li>
            <LogoutButton variant="row" className={SETTINGS_ROW} />
          </li>
        </SettingsGroup>
      </div>
    </>
  );
}
