import { z } from "zod";

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

export const envSchema = z.object({
  DATABASE_URL: postgresUrl,
  DIRECT_URL: postgresUrl.optional(),

  BETTER_AUTH_SECRET: requiredString.min(32, "skal være mindst 32 tegn (openssl rand -base64 32)"),
  BETTER_AUTH_URL: z.url({ protocol: /^https?$/, error: "skal være en http(s)-URL" }),

  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,

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
});

export type Env = z.infer<typeof envSchema>;

export type ParsedEnv = {
  env: Env;
  /** Both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set. */
  isGoogleConfigured: boolean;
  /** SMTP_HOST, SMTP_USER and SMTP_PASSWORD are all set. */
  isSmtpConfigured: boolean;
  /** RATE_LIMIT_DISABLED is set and NODE_ENV is not "production". */
  isRateLimitDisabled: boolean;
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

  const googleParts = [env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET];
  const isGoogleConfigured = googleParts.every(Boolean);
  if (!isGoogleConfigured && googleParts.some(Boolean)) {
    warnings.push(
      "Google-login er slået fra: både GOOGLE_CLIENT_ID og GOOGLE_CLIENT_SECRET skal være sat.",
    );
  }

  const smtpParts = [env.SMTP_HOST, env.SMTP_USER, env.SMTP_PASSWORD];
  const isSmtpConfigured = smtpParts.every(Boolean);
  if (!isSmtpConfigured && (env.SMTP_USER || env.SMTP_PASSWORD)) {
    warnings.push(
      "Email (SMTP) er slået fra: SMTP_HOST, SMTP_USER og SMTP_PASSWORD skal alle være sat.",
    );
  }

  const isProduction = source.NODE_ENV === "production";
  const isRateLimitDisabled = env.RATE_LIMIT_DISABLED === true && !isProduction;
  if (env.RATE_LIMIT_DISABLED === true && isProduction) {
    warnings.push("RATE_LIMIT_DISABLED ignoreres i produktion: rate limiting er slået til.");
  }

  return { env, isGoogleConfigured, isSmtpConfigured, isRateLimitDisabled, warnings };
}
