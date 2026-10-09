import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { after } from "next/server";

import { env, isGoogleConfigured, isRateLimitDisabled } from "@/env";
import { appUrl, getAppUrl, passwordResetUrl } from "@/lib/app-url";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/validation/auth";
import { db } from "@/server/db";
import { cleanUserName, resolveNewUserName } from "@/server/domain/users/user-name";
import { sendEmail } from "@/server/email/send-email";
import { passwordResetEmail } from "@/server/email/templates";

import { AUTH_RATE_LIMITED_PATHS, authBeforeHook } from "./auth-rate-limit";
import { SESSION_REFRESH_SECONDS, SESSION_TTL_SECONDS } from "./session-refresh";
import { isAllowedUserImage, USER_IMAGE_NOT_ALLOWED_MESSAGE } from "./user-image";

/**
 * Better Auth (SPEC §6): email/password, Google, password reset, sessions in
 * Postgres via Prisma. Mounted at /api/auth/* (src/app/api/auth/[...all]).
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

/** Reads the `picture` claim from a Google id token (already verified by Better Auth). */
function pictureFromIdToken(idToken: string | null | undefined): string | null {
  const payload = idToken?.split(".")[1];
  if (!payload) return null;
  try {
    const claims: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof claims !== "object" || claims === null || !("picture" in claims)) return null;
    const { picture } = claims as { picture: unknown };
    return typeof picture === "string" && isAllowedUserImage(picture) ? picture : null;
  } catch {
    return null;
  }
}

export const auth = betterAuth({
  appName: "Ølklubben",
  baseURL: getAppUrl(),
  secret: env.BETTER_AUTH_SECRET,
  telemetry: { enabled: false },

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

  socialProviders: isGoogleConfigured
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID ?? "",
          clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
          prompt: "select_account",
        },
      }
    : {},

  account: {
    accountLinking: {
      enabled: true,
      // SPEC §6.2 / E19: Google is linked onto an existing email/password account
      // with the same email only when Google reports the email as verified.
      // Google is NOT a trusted provider, so an unverified Google email never links.
      trustedProviders: [],
      allowDifferentEmails: false,
      // Our email/password accounts never verify their email (no verification
      // mail in the MVP), so Better Auth's default (require a verified local
      // email before linking) would block every link. Deprecated in 1.7 and
      // removed in the next minor – see the note in SPEC §19.5.
      requireLocalEmailVerified: false,
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
    },
  },

  hooks: {
    // Rate limits, and "Glemt password" is refused when no email can be sent
    // (production without SMTP, SPEC §6.4). See auth-rate-limit.ts.
    before: authBeforeHook,
  },

  // Failed Google logins land on /login?error=<code> (getOAuthErrorMessage()).
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
        // SPEC §6.2: the profile picture comes from Google. A new Google user gets
        // it on creation; an existing email/password user gets it when Google is
        // linked, unless they already have one.
        after: async (account) => {
          if (account.providerId !== "google") return;
          const picture = pictureFromIdToken(account.idToken);
          if (!picture) return;
          await db.user.updateMany({
            where: { id: account.userId, image: null },
            data: { image: picture },
          });
        },
      },
    },
  },

  // nextCookies must be the last plugin: it lets Server Actions set auth cookies.
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
export type AuthUser = AuthSession["user"];
