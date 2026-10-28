import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { auth0, genericOAuth } from "better-auth/plugins/generic-oauth";
import { after } from "next/server";

import { env, externalProvider, isRateLimitDisabled } from "@/env";
import { appUrl, getAppUrl, passwordResetUrl } from "@/lib/app-url";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { isExternalProvider } from "@/lib/auth-providers";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/validation/auth";
import { db } from "@/server/db";
import { cleanUserName, resolveNewUserName } from "@/server/domain/users/user-name";
import { sendEmail } from "@/server/email/send-email";
import { passwordResetEmail } from "@/server/email/templates";

import { AUTH_RATE_LIMITED_PATHS, authBeforeHook } from "./auth-rate-limit";
import { claimsFromIdToken, isAllowedAuth0Subject } from "./external-claims";
import { SESSION_REFRESH_SECONDS, SESSION_TTL_SECONDS } from "./session-refresh";
import { isAllowedUserImage, USER_IMAGE_NOT_ALLOWED_MESSAGE } from "./user-image";

/**
 * Better Auth (SPEC §6): email/password, one external login (Auth0 Universal
 * Login or Google, D-166), password reset, sessions in Postgres via Prisma.
 * Mounted at /api/auth/* (src/app/api/auth/[...all]).
 *
 * Server code reads the session through src/server/auth/session.ts, not
 * through this object directly.
 */

/** Reset tokens (email and admin link) expire after 1 hour (SPEC §6.4). */
export const PASSWORD_RESET_TOKEN_TTL_SECONDS = 60 * 60;

/**
 * Runs Better Auth's non-critical work (the reset email, cleanup) after the
 * response is sent. Besides being faster, it keeps "Glemt password" from
 * revealing through response time whether an email exists (SPEC §6.4).
 * Outside a Next.js request (scripts, tests) the promise simply runs on.
 */
function runAfterResponse(promise: Promise<unknown>): void {
  try {
    after(promise);
  } catch {
    promise.catch((error: unknown) => console.error("[auth] Baggrundsopgave fejlede", error));
  }
}

/**
 * Auth0 Universal Login (D-166) on Better Auth's core social endpoints, so
 * every account rule below applies to it too. The id token must verify
 * against the tenant's JWKS; without a usable discovery document (fetched
 * once per server instance) the provider is skipped, never trusted
 * unverified. Never set overrideUserInfo: it would overwrite the account's
 * email from Auth0 on every sign-in (D-151).
 */
function auth0Plugin() {
  const domain = env.AUTH0_DOMAIN ?? "";
  return genericOAuth({
    config: [
      {
        ...auth0({
          domain,
          clientId: env.AUTH0_CLIENT_ID ?? "",
          clientSecret: env.AUTH0_CLIENT_SECRET ?? "",
          postLogoutRedirectURI: appUrl("/login"),
          endSessionEndpoint: `https://${domain}/oidc/logout`,
        }),
        requireIdTokenVerification: true,
      },
    ],
  });
}

export const auth = betterAuth({
  appName: "Ølklubben",
  baseURL: getAppUrl(),
  secret: env.BETTER_AUTH_SECRET,
  telemetry: { enabled: false },

  // Closed over HTTP (D-165; auth.api still has them): /unlink-account lets a
  // stolen session strip a login, the token endpoints hand out stored tokens,
  // and /update-user accepts any image (profile changes use our own actions).
  disabledPaths: [
    "/unlink-account",
    "/get-access-token",
    "/refresh-token",
    "/account-info",
    "/update-user",
  ],

  database: prismaAdapter(db, { provider: "postgresql", transaction: true }),

  advanced: {
    // Ids are UUIDv7 strings from Prisma (@default(uuid(7))), like the app's own tables.
    database: { generateId: "uuid" },
    backgroundTasks: { handler: runAfterResponse },
  },

  user: {
    additionalFields: {
      // Exposed on session.user; set by the app (rememberActiveClub), never by the client.
      lastActiveClubId: { type: "string", required: false, input: false },
      // The global nickname (D-105). input:false: sign-up and POST /update-user
      // refuse it (FIELD_NOT_ALLOWED). Written only by updateUserProfile
      // (src/server/users/mutations.ts) together with the name.
      nickname: { type: "string", required: false, input: false },
    },
  },

  // Sessions last 60 days and slide forward once a day while in use (D-030).
  // Only GET /api/auth/get-session refreshes them (see session-refresh.ts).
  session: {
    expiresIn: SESSION_TTL_SECONDS,
    updateAge: SESSION_REFRESH_SECONDS,
  },

  emailAndPassword: {
    enabled: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
    autoSignIn: true,
    requireEmailVerification: false,
    resetPasswordTokenExpiresIn: PASSWORD_RESET_TOKEN_TTL_SECONDS,
    // A reset (by email or admin link) logs the account out everywhere else.
    revokeSessionsOnPasswordReset: true,
    // …and revokes the user's other reset links (SPEC §6.4, D-030): an older
    // email or admin link must not work after the password was changed.
    // Better Auth calls this after the new password is saved, for every reset.
    // Identifiers are stored hashed, so match on `value`: in this config only
    // reset rows hold a bare user id there (OAuth state rows hold JSON).
    onPasswordReset: async ({ user }) => {
      await db.verification.deleteMany({ where: { value: user.id } });
    },
    // The link always points at our own page (/reset-password?token=…), the same
    // URL the admin-generated link uses (src/server/auth/reset-link.ts).
    sendResetPassword: async ({ user, url, token }) => {
      // Our own link format (F-007, D-030). Better Auth's `url` only carries the
      // redirectTo of requestPasswordResetAction as ?callbackURL=: a safe
      // ?next= (e.g. an invitation, §6.5) that the reset page passes on.
      const next = safeRedirectPath(new URL(url).searchParams.get("callbackURL"));
      await sendEmail(
        passwordResetEmail({ to: user.email, name: user.name, url: passwordResetUrl(token, next) }),
      );
    },
  },

  // With Auth0 configured, Google is offered inside Auth0 instead (D-166).
  socialProviders:
    externalProvider === "google"
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID ?? "",
            clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
            prompt: "select_account",
            disableIdTokenSignIn: true,
          },
        }
      : {},

  account: {
    encryptOAuthTokens: true,
    accountLinking: {
      enabled: true,
      // SPEC §6.2 / D-165: never link implicitly. Password accounts never
      // verify their email (D-029), so anyone can register someone else's
      // address; linking that address's Google on sign-in would hand the
      // account to both. The owner links it on Profil instead (/link-social).
      disableImplicitLinking: true,
      // No trusted providers: an unverified external email never links.
      trustedProviders: [],
      allowDifferentEmails: false,
      // Keep the name the user chose; the image is adopted separately (below).
      updateUserInfoOnLink: false,
    },
  },

  verification: {
    // Reset tokens and OAuth state are stored as SHA-256 hashes.
    storeIdentifier: "hashed",
  },

  rateLimit: {
    enabled: !isRateLimitDisabled,
    // Serverless functions share no memory (SPEC §4.8).
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      // Sign-in, sign-up and password reset are limited by authBeforeHook,
      // which also covers Server Action calls (see auth-rate-limit.ts).
      ...Object.fromEntries(AUTH_RATE_LIMITED_PATHS.map((path) => [path, false as const])),
      // "Fortsæt med Google": the default (3 per 10 s per IP) is too tight for a
      // club on one pub wifi.
      "/sign-in/social": { window: 60, max: 20 },
      "/link-social": { window: 60, max: 10 },
    },
  },

  hooks: {
    // Rate limits, and "Glemt password" is refused when no email can be sent
    // (production without SMTP, SPEC §6.4). See auth-rate-limit.ts.
    before: authBeforeHook,
  },

  // Failed external logins land on /login?error=<code> (getOAuthErrorMessage()).
  onAPIError: { errorURL: appUrl("/login") },

  databaseHooks: {
    user: {
      create: {
        // Every path into the users table gets a 1–100 character name (CHECK
        // constraint), and an image only from Google (user-image.ts): sign-up
        // through the API accepts any `image`. Google's picture survives here,
        // and the account hook below fills it in for new Google users anyway.
        before: async (user) => ({
          data: {
            ...user,
            name: resolveNewUserName(user.name, user.email),
            image: isAllowedUserImage(user.image) ? user.image : null,
          },
        }),
      },
      update: {
        before: async (data) => {
          // POST /api/auth/update-user accepts any `image` (round 1: Google only).
          // A 400 instead of storing a tracking pixel – or a 500 for non-strings.
          if ("image" in data && data.image !== undefined && !isAllowedUserImage(data.image)) {
            throw new APIError("BAD_REQUEST", { message: USER_IMAGE_NOT_ALLOWED_MESSAGE });
          }
          if (!("name" in data) || data.name === undefined) return;
          const name = cleanUserName(data.name);
          if (!name) return false;
          return { data: { ...data, name } };
        },
      },
    },
    account: {
      create: {
        // SPEC §6.2, D-165, D-166: an external login always belongs to the
        // account's own, verified email; an unknown provider fails closed.
        // Throwing (not returning false) rolls the whole sign-up back, and the
        // callback redirects with the code (/login?error=…).
        before: async (account) => {
          if (account.providerId === "credential") return;
          if (!isExternalProvider(account.providerId)) {
            throw new APIError("FORBIDDEN", {
              code: "connection_not_allowed",
              message: "Den login-udbyder er ikke tilladt.",
            });
          }
          if (account.providerId === "auth0" && !isAllowedAuth0Subject(account.accountId)) {
            throw new APIError("FORBIDDEN", {
              code: "connection_not_allowed",
              message: "Den Auth0-forbindelse er ikke tilladt.",
            });
          }
          const claims = claimsFromIdToken(account.idToken);
          if (!claims?.email || !claims.emailVerified) {
            throw new APIError("FORBIDDEN", {
              code: "email_not_verified",
              message: "Emailen er ikke bekræftet.",
            });
          }
          // Better Auth compares a link with the email frozen in the OAuth
          // state; "Skift email" may have run since. A brand-new user is not
          // visible here yet (uncommitted transaction).
          const user = await db.user.findUnique({
            where: { id: account.userId },
            select: { email: true },
          });
          if (user && user.email !== claims.email) {
            throw new APIError("FORBIDDEN", {
              code: "email_does_not_match",
              message: "Den eksterne konto har en anden email end kontoen.",
            });
          }
        },
        // SPEC §6.2: adopt Google's picture (also via Auth0) unless the user
        // has one. Linking also verifies the email (Better Auth only does that
        // on sign-in), which app-admin requires (§9.9, D-165).
        after: async (account) => {
          if (!isExternalProvider(account.providerId)) return;
          const claims = claimsFromIdToken(account.idToken);
          if (!claims) return;
          if (claims.picture) {
            await db.user.updateMany({
              where: { id: account.userId, image: null },
              data: { image: claims.picture },
            });
          }
          if (claims.email && claims.emailVerified) {
            await db.user.updateMany({
              where: { id: account.userId, email: claims.email, emailVerified: false },
              data: { emailVerified: true },
            });
          }
        },
      },
    },
  },

  plugins: [
    ...(externalProvider === "auth0" ? [auth0Plugin()] : []),
    // nextCookies must be the last plugin: it lets Server Actions set auth cookies.
    nextCookies(),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
export type AuthUser = AuthSession["user"];
