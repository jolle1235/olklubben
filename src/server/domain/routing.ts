/**
 * Where `/` sends a logged-in user (SPEC §10.1, E15).
 *
 *   0 clubs  → onboarding
 *   1 club   → that club (never a manual choice, §3.1)
 *   2+ clubs → the last active club if the user is still a member of it,
 *              otherwise the club picker
 *
 * A pending invitation code is handled before this (the ?next=/join/<code>
 * parameter after login/signup, §6.5).
 *
 * Pure module: no Next.js, React or database imports.
 */

export type HomeDestination =
  { kind: "onboarding" } | { kind: "club"; clubId: string } | { kind: "picker" };

export function resolveHomeDestination(input: {
  clubIds: readonly string[];
  lastActiveClubId: string | null;
}): HomeDestination {
  const clubIds = [...new Set(input.clubIds)];

  const [onlyClubId] = clubIds;
  if (onlyClubId === undefined) return { kind: "onboarding" };
  if (clubIds.length === 1) return { kind: "club", clubId: onlyClubId };

  const { lastActiveClubId } = input;
  if (lastActiveClubId !== null && clubIds.includes(lastActiveClubId)) {
    return { kind: "club", clubId: lastActiveClubId };
  }
  return { kind: "picker" };
}

/** The URL for a destination: "/onboarding", "/c/<clubId>" or "/clubs". */
export function homeDestinationPath(destination: HomeDestination): string {
  switch (destination.kind) {
    case "onboarding":
      return "/onboarding";
    case "club":
      return `/c/${destination.clubId}`;
    case "picker":
      return "/clubs";
  }
}

/**
 * Where /profile sends a logged-in user (D-023): the Profil tab of the last
 * active club if they are still a member of it (E15), otherwise of their first
 * club, otherwise onboarding.
 */
export function resolveProfilePath(input: {
  /** The user's clubs, in display order (getUserClubs: sorted by name). */
  clubIds: readonly string[];
  lastActiveClubId: string | null;
}): string {
  const { clubIds, lastActiveClubId } = input;
  const clubId =
    lastActiveClubId !== null && clubIds.includes(lastActiveClubId) ? lastActiveClubId : clubIds[0];
  return clubId === undefined ? "/onboarding" : `/c/${clubId}/profile`;
}
