import "server-only";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { withNext } from "@/lib/auth-links";
import { isValidId } from "@/lib/ids";
import { RETURN_TO_HEADER } from "@/lib/protected-paths";
import { db } from "@/server/db";
import type { ClubRole } from "@/server/domain/clubs/permissions";
import { homeDestinationPath, resolveHomeDestination } from "@/server/domain/routing";

import { auth, type AuthSession } from "./auth";

/**
 * Session and membership helpers for Server Components, Route Handlers and
 * Server Actions (SPEC §4.3 steps 2–3, §4.4).
 *
 * The proxy (src/proxy.ts) only redirects optimistically on a missing cookie.
 * These helpers are the real check and must be called on every request that
 * needs a user or a club.
 */

export type SessionUser = {
  id: string;
  name: string;
  /** Lowercase. */
  email: string;
  emailVerified: boolean;
  image: string | null;
  lastActiveClubId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AppSession = {
  session: AuthSession["session"];
  user: SessionUser;
};

export type MembershipInfo = {
  id: string;
  userId: string;
  clubId: string;
  role: ClubRole;
  joinedAt: Date;
};

export type ClubInfo = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
};

export type UserClub = {
  id: string;
  name: string;
  role: ClubRole;
  memberCount: number;
};

function toSessionUser(user: AuthSession["user"]): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    image: user.image ?? null,
    lastActiveClubId: user.lastActiveClubId ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * The current session and user, or null when logged out. Cached per request.
 *
 * Never refreshes the session (D-030): Server Components cannot set cookies,
 * so a refresh here would move the expiry in the database while the browser
 * keeps the old cookie (nextCookies swallows the write). Pages render
 * <SessionRefresh /> instead, which refreshes through the get-session Route
 * Handler when it is due (src/server/auth/session-refresh.ts).
 */
export const getSession = cache(async (): Promise<AppSession | null> => {
  const result = await auth.api.getSession({
    headers: await headers(),
    query: { disableRefresh: true },
  });
  if (!result) return null;
  return { session: result.session, user: toSessionUser(result.user) };
});

/**
 * The logged-in user, or a redirect to /login (SPEC §4.3 step 2).
 *
 * The redirect keeps the way back as /login?next=…: `returnTo` when given (a
 * same-origin path), else the page the proxy saw (RETURN_TO_HEADER, set only
 * for protected GET/HEAD requests that carry a session cookie). That covers a
 * stale cookie, e.g. after a password reset or an expired session: the proxy
 * lets the request through, and the deep link still survives the login.
 * withNext() drops anything that is not a safe same-origin path.
 */
export async function requireUser(options?: { returnTo?: string }): Promise<SessionUser> {
  const session = await getSession();
  if (session) return session.user;

  const returnTo = options?.returnTo ?? (await headers()).get(RETURN_TO_HEADER) ?? undefined;
  redirect(withNext("/login", returnTo));
}

/**
 * The user's membership of a club, or a 404 (SPEC §4.3 step 3, §4.4, D-012).
 *
 * `clubId` comes from the URL and is untrusted: a malformed id, a club that
 * does not exist and a club the user is not a member of all give notFound(),
 * never 403, so nothing reveals that a club exists. Membership is always
 * looked up by (userId, clubId). Not logged in → redirect to /login.
 *
 * Cached per request, so a layout and its page can both call it.
 */
export const requireMembership = cache(
  async (
    clubId: string,
  ): Promise<{ user: SessionUser; membership: MembershipInfo; club: ClubInfo }> => {
    const user = await requireUser();
    if (!isValidId(clubId)) notFound();

    const membership = await db.membership.findUnique({
      where: { userId_clubId: { userId: user.id, clubId } },
      select: {
        id: true,
        userId: true,
        clubId: true,
        role: true,
        joinedAt: true,
        club: { select: { id: true, name: true, description: true, createdAt: true } },
      },
    });
    if (!membership) notFound();

    const { club, ...membershipInfo } = membership;
    return { user, membership: membershipInfo, club };
  },
);

/**
 * The clubs a user is a member of, sorted by name the Danish way (æ, ø, å
 * last). For the club picker (/clubs) and the ClubSwitcher. Cached per request.
 */
export const getUserClubs = cache(async (userId: string): Promise<UserClub[]> => {
  const memberships = await db.membership.findMany({
    where: { userId },
    select: {
      role: true,
      club: { select: { id: true, name: true, _count: { select: { memberships: true } } } },
    },
  });

  return memberships
    .map(({ role, club }) => ({
      id: club.id,
      name: club.name,
      role,
      memberCount: club._count.memberships,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "da") || a.id.localeCompare(b.id));
});

/**
 * Where `/` (and a login without ?next=) should send the user (SPEC §10.1):
 * "/onboarding", "/c/<clubId>" or "/clubs".
 */
export async function getHomePath(
  user: Pick<SessionUser, "id" | "lastActiveClubId">,
): Promise<string> {
  const clubs = await getUserClubs(user.id);
  return homeDestinationPath(
    resolveHomeDestination({
      clubIds: clubs.map((club) => club.id),
      lastActiveClubId: user.lastActiveClubId,
    }),
  );
}

/**
 * Remembers the club the user is looking at (User.lastActiveClubId, SPEC §4.5,
 * §10.3). Writes only when the value changes.
 *
 * Call it from club pages (through requireClubPage), never from a layout: a
 * Link prefetch renders the layouts above the nearest loading.tsx, so a layout
 * would switch the active club when a link to another club merely scrolls into
 * view. Pages below the loading boundary only render on a real navigation.
 * Never use prefetch={true} on links into another club, because a full
 * prefetch renders the page as well.
 *
 * A prefetch cannot be detected here: Next 16 hides its Flight headers
 * (Next-Router-Prefetch, RSC, …) from headers() and from the proxy.
 */
export async function rememberActiveClub(
  user: Pick<SessionUser, "id" | "lastActiveClubId">,
  clubId: string,
): Promise<void> {
  if (user.lastActiveClubId === clubId) return;
  await db.user.update({ where: { id: user.id }, data: { lastActiveClubId: clubId } });
}

/**
 * For every page under /c/[clubId] (D-036): requireMembership() (404 for
 * non-members, E16), then remembers the club as the active one (§10.3).
 *
 * Server Actions and routes that must not change the active club (e.g. the
 * unknown-route catch-all) call requireMembership() directly.
 */
export async function requireClubPage(
  clubId: string,
): Promise<{ user: SessionUser; membership: MembershipInfo; club: ClubInfo }> {
  const result = await requireMembership(clubId);
  await rememberActiveClub(result.user, result.club.id);
  return result;
}
