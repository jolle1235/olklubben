import { z } from "zod";

import type { ExternalProviderId } from "@/lib/auth-providers";

/**
 * Pure parsing of the server environment (SPEC §4.7–4.8).
 *
 * Kept free of `server-only` and of `process.env` so it can be unit-tested.
 * Application code must import `@/env` instead, never this file.
 */

const requiredString = z.string().min(1, "mangler");
const optionalString = z.string().min(1).optional();
const postgresUrl = z.url({
  protocol: /^postgres(ql)?$/,
  error: "skal være en postgresql:// connection string",
});

const emailSchema = z.email();

/** A bare hostname such as "olklubben-abc.vercel.app" (no scheme, path or port). */
const HOSTNAME = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;

/**
 * APP_ADMIN_EMAILS as a list (D-142): split on ",", trimmed, empty entries
 * dropped, lowercased (account emails are always lowercase), de-duplicated.
 * `invalid` holds the entries that are not an email, as written (trimmed).
 */
export function parseAppAdminEmails(raw: string | undefined): {
  emails: string[];
  invalid: string[];
} {
  const emails: string[] = [];
  const invalid: string[] = [];
  for (const part of (raw ?? "").split(",")) {
    const entry = part.trim();
    if (entry === "") continue;
    const email = entry.toLowerCase();
    if (!emailSchema.safeParse(email).success) invalid.push(entry);
    else if (!emails.includes(email)) emails.push(email);
  }
  return { emails, invalid };
}

export const envSchema = z
  .object({
    DATABASE_URL: postgresUrl,
    DIRECT_URL: postgresUrl.optional(),

    BETTER_AUTH_SECRET: requiredString.min(
      32,
      "skal være mindst 32 tegn (openssl rand -base64 32)",
    ),
    // Required, except on Vercel Production, where the app URL comes from
    // VERCEL_PROJECT_PRODUCTION_URL instead (D-164, see the refinement below).
    BETTER_AUTH_URL: z.url({ protocol: /^https?$/, error: "skal være en http(s)-URL" }).optional(),

    // Set by Vercel (system environment variables), never by hand. On Production
    // the project's production domain is the app URL (D-164): a hand-set
    // BETTER_AUTH_URL once pointed invitation links at a single failed deployment.
    VERCEL_ENV: optionalString,
    VERCEL_PROJECT_PRODUCTION_URL: z
      .string()
      .regex(HOSTNAME, "skal være et domænenavn uden https:// (sættes af Vercel)")
      .optional(),

    GOOGLE_CLIENT_ID: optionalString,
    GOOGLE_CLIENT_SECRET: optionalString,

    AUTH0_DOMAIN: z
      .string()
      .regex(HOSTNAME, "skal være et domænenavn uden https:// (fx olklubben.eu.auth0.com)")
      .optional(),
    AUTH0_CLIENT_ID: optionalString,
    AUTH0_CLIENT_SECRET: optionalString,

    SMTP_HOST: optionalString,
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(465),
    SMTP_USER: optionalString,
    SMTP_PASSWORD: optionalString,
    EMAIL_FROM: optionalString,

    // Development/test only (D-024): directory for the dev email outbox. Relative
    // paths are resolved from the project root. Default: .dev-outbox
    DEV_OUTBOX_DIR: optionalString,
    // Development/test only: "1"/"true" switches rate limiting off (E2E creates
    // many users from one IP). Ignored when NODE_ENV=production.
    RATE_LIMIT_DISABLED: z.stringbool({ error: "skal være 1/0 eller true/false" }).optional(),

    // Round 4 (§4.8, D-131): Vercel Cron sends it as "Authorization: Bearer …" to
    // /api/cron/close-polls. Unset → the daily close is switched off (503).
    CRON_SECRET: z.string().min(16, "skal være mindst 16 tegn (openssl rand -hex 32)").optional(),

    // Feedback (§9.9, D-142): comma-separated emails of the app-admins, who set a
    // report's status, answer it and mark duplicates. Unset → nobody can. Every
    // entry must be an email (a typo would silently leave the app without an admin).
    APP_ADMIN_EMAILS: z
      .string()
      .optional()
      .superRefine((value, ctx) => {
        for (const entry of parseAppAdminEmails(value).invalid) {
          ctx.addIssue({ code: "custom", message: `«${entry}» er ikke en gyldig email` });
        }
      }),
  })
  .superRefine(
    (env, ctx) => {
      if (!env.BETTER_AUTH_URL && !vercelProductionUrl(env)) {
        ctx.addIssue({ code: "custom", path: ["BETTER_AUTH_URL"], message: "mangler" });
      }
    },
    // Also when other variables are invalid, so one error lists everything.
    { when: () => true },
  );

/** https://<production domain> on Vercel Production, else undefined (D-164). */
function vercelProductionUrl(env: {
  VERCEL_ENV?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
}): string | undefined {
  if (env.VERCEL_ENV !== "production" || !env.VERCEL_PROJECT_PRODUCTION_URL) return undefined;
  return `https://${env.VERCEL_PROJECT_PRODUCTION_URL.toLowerCase()}`;
}

export type Env = z.infer<typeof envSchema>;

export type ParsedEnv = {
  env: Env;
  /**
   * The app's own base URL, without a trailing "/" (invitation and reset links,
   * Better Auth's baseURL): the production domain on Vercel Production (D-164),
   * else BETTER_AUTH_URL.
   */
  appBaseUrl: string;
  /** Both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set. */
  isGoogleConfigured: boolean;
  /** AUTH0_DOMAIN, AUTH0_CLIENT_ID and AUTH0_CLIENT_SECRET are all set. */
  isAuth0Configured: boolean;
  /** The one external login (D-166): Auth0 wins over Google (Google is inside Auth0). */
  externalProvider: ExternalProviderId | null;
  /** SMTP_HOST, SMTP_USER and SMTP_PASSWORD are all set. */
  isSmtpConfigured: boolean;
  /** RATE_LIMIT_DISABLED is set and NODE_ENV is not "production". */
  isRateLimitDisabled: boolean;
  /** APP_ADMIN_EMAILS, lowercased and de-duplicated ([] when unset, D-142). */
  appAdminEmails: readonly string[];
  /** Human-readable notes about half-configured optional features. */
  warnings: string[];
};

type RawEnv = Record<string, string | undefined>;

/** Treats empty strings ("" from a copied .env.example) as "not set". */
function withoutEmptyValues(source: RawEnv): RawEnv {
  const result: RawEnv = {};
  for (const key of Object.keys(envSchema.shape)) {
    const value = source[key]?.trim();
    result[key] = value === "" ? undefined : value;
  }
  return result;
}

/**
 * Validates the environment. Throws one error listing every invalid or missing
 * variable, so a misconfigured deploy fails loudly at startup.
 */
export function parseEnv(source: RawEnv): ParsedEnv {
  const result = envSchema.safeParse(withoutEmptyValues(source));

  if (!result.success) {
    const problems = result.error.issues.map((issue) => {
      const name = issue.path.join(".");
      const reason = issue.code === "invalid_type" ? "mangler" : issue.message;
      return `  - ${name}: ${reason}`;
    });
    throw new Error(
      `Ugyldige miljøvariabler:\n${problems.join("\n")}\n` +
        "Se .env.example og README.md (lokal opsætning).",
    );
  }

  const env = result.data;
  const warnings: string[] = [];

  const productionUrl = vercelProductionUrl(env);
  const configuredUrl = env.BETTER_AUTH_URL?.replace(/\/+$/, "");
  // The refinement above guarantees one of them.
  const appBaseUrl = productionUrl ?? configuredUrl ?? "";
  if (productionUrl && configuredUrl && configuredUrl !== productionUrl) {
    warnings.push(
      `BETTER_AUTH_URL (${configuredUrl}) ignoreres i produktion: appen bruger ${productionUrl} (VERCEL_PROJECT_PRODUCTION_URL).`,
    );
  }

  const googleParts = [env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET];
  const isGoogleConfigured = googleParts.every(Boolean);
  if (!isGoogleConfigured && googleParts.some(Boolean)) {
    warnings.push(
      "Google-login er slået fra: både GOOGLE_CLIENT_ID og GOOGLE_CLIENT_SECRET skal være sat.",
    );
  }

  const auth0Parts = [env.AUTH0_DOMAIN, env.AUTH0_CLIENT_ID, env.AUTH0_CLIENT_SECRET];
  const isAuth0Configured = auth0Parts.every(Boolean);
  if (!isAuth0Configured && auth0Parts.some(Boolean)) {
    warnings.push(
      "Auth0-login er slået fra: AUTH0_DOMAIN, AUTH0_CLIENT_ID og AUTH0_CLIENT_SECRET skal alle være sat.",
    );
  }
  if (isAuth0Configured && isGoogleConfigured) {
    warnings.push("Google-login er slået fra, fordi Auth0 er sat op (Google ligger i Auth0).");
  }
  const externalProvider: ExternalProviderId | null = isAuth0Configured
    ? "auth0"
    : isGoogleConfigured
      ? "google"
      : null;

  const smtpParts = [env.SMTP_HOST, env.SMTP_USER, env.SMTP_PASSWORD];
  const isSmtpConfigured = smtpParts.every(Boolean);
  if (!isSmtpConfigured && (env.SMTP_USER || env.SMTP_PASSWORD)) {
    warnings.push(
      "Email (SMTP) er slået fra: SMTP_HOST, SMTP_USER og SMTP_PASSWORD skal alle være sat.",
    );
  }

  const isProduction = source.NODE_ENV === "production";
  if (isProduction && !env.CRON_SECRET) {
    warnings.push("Den daglige lukning af afstemninger er slået fra: CRON_SECRET mangler.");
  }
  const isRateLimitDisabled = env.RATE_LIMIT_DISABLED === true && !isProduction;
  if (env.RATE_LIMIT_DISABLED === true && isProduction) {
    warnings.push("RATE_LIMIT_DISABLED ignoreres i produktion: rate limiting er slået til.");
  }

  const appAdminEmails = parseAppAdminEmails(env.APP_ADMIN_EMAILS).emails;
  if (isProduction && appAdminEmails.length === 0) {
    warnings.push("Ingen app-admin: APP_ADMIN_EMAILS er tom, så feedback-status kan ikke ændres.");
  }

  return {
    env,
    appBaseUrl,
    isGoogleConfigured,
    isAuth0Configured,
    externalProvider,
    isSmtpConfigured,
    isRateLimitDisabled,
    appAdminEmails,
    warnings,
  };
}
