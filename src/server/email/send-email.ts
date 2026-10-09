import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { createTransport } from "nodemailer";

import { env, isSmtpConfigured } from "@/env";

/**
 * The single way the app sends email (SPEC §6.4, D-017, D-024). Swap the
 * provider here (Gmail SMTP today, Resend later, TG-001) without touching
 * callers.
 *
 * Delivery, in order:
 *   1. SMTP (nodemailer) when SMTP_HOST, SMTP_USER and SMTP_PASSWORD are set.
 *   2. Otherwise, outside production: the dev outbox. Each email is written as
 *      JSON to DEV_OUTBOX_DIR (default .dev-outbox/) and a short line is logged.
 *      E2E tests read reset links from there.
 *   3. Otherwise (production without SMTP): sendEmail() throws
 *      EmailDeliveryUnavailableError and isEmailDeliveryAvailable() is false, so
 *      "Glemt password" can show "Kontakt en admin i din klub for at få et
 *      nulstillingslink." instead.
 */

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/** The JSON written to the dev outbox (one file per email). */
export type DevOutboxEmail = EmailMessage & {
  id: string;
  from: string;
  createdAt: string;
  /** Every http(s) URL found in the text body, e.g. the reset link. */
  links: string[];
};

export const EMAIL_DELIVERY_UNAVAILABLE = "EMAIL_DELIVERY_UNAVAILABLE";

export class EmailDeliveryUnavailableError extends Error {
  readonly code = EMAIL_DELIVERY_UNAVAILABLE;

  constructor() {
    super(
      "Email er ikke sat op: SMTP_HOST, SMTP_USER og SMTP_PASSWORD mangler, og produktion har ingen dev-outbox.",
    );
    this.name = "EmailDeliveryUnavailableError";
  }
}

const DEFAULT_OUTBOX_DIR = ".dev-outbox";

function isDevOutboxEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

/** True when sendEmail() can deliver: SMTP is configured, or the dev outbox is active. */
export function isEmailDeliveryAvailable(): boolean {
  return isSmtpConfigured || isDevOutboxEnabled();
}

/** Absolute path of the dev outbox directory (DEV_OUTBOX_DIR or .dev-outbox/). */
export function getDevOutboxDir(): string {
  // turbopackIgnore: a runtime path built from process.cwd() would otherwise make
  // Turbopack trace (and deploy) the whole project into the server functions.
  // The outbox is a development-only directory that is never part of a build.
  return path.resolve(
    /* turbopackIgnore: true */ process.cwd(),
    env.DEV_OUTBOX_DIR ?? DEFAULT_OUTBOX_DIR,
  );
}

function getSender(): string {
  return env.EMAIL_FROM ?? `"Ølklubben" <${env.SMTP_USER ?? "noreply@localhost"}>`;
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  if (isSmtpConfigured) {
    await getSmtpTransport().sendMail({
      from: getSender(),
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
    });
    return;
  }

  if (isDevOutboxEnabled()) {
    await writeToDevOutbox(message);
    return;
  }

  throw new EmailDeliveryUnavailableError();
}

// ─── SMTP ───────────────────────────────────────────────────────────────────

function createSmtpTransport() {
  return createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    // 465 = TLS from the start (Gmail's SMTPS); other ports upgrade via STARTTLS.
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });
}

let smtpTransport: ReturnType<typeof createSmtpTransport> | undefined;

function getSmtpTransport(): ReturnType<typeof createSmtpTransport> {
  smtpTransport ??= createSmtpTransport();
  return smtpTransport;
}

// ─── Dev outbox (D-024) ─────────────────────────────────────────────────────

const URL_PATTERN = /https?:\/\/[^\s<>"')]+/g;

function slugify(value: string): string {
  const slug = value
    .replace(/æ/gi, "ae")
    .replace(/ø/gi, "oe")
    .replace(/å/gi, "aa")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "email";
}

async function writeToDevOutbox(message: EmailMessage): Promise<void> {
  const dir = getDevOutboxDir();
  const now = new Date();
  const id = randomUUID();
  const email: DevOutboxEmail = {
    id,
    from: getSender(),
    to: message.to,
    subject: message.subject,
    text: message.text,
    ...(message.html ? { html: message.html } : {}),
    createdAt: now.toISOString(),
    links: message.text.match(URL_PATTERN) ?? [],
  };

  // Sortable by name: 2026-10-08T14-46-33-123Z-nulstil-dit-password-1a2b3c4d.json
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  const fileName = `${timestamp}-${slugify(message.subject)}-${id.slice(0, 8)}.json`;

  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), `${JSON.stringify(email, null, 2)}\n`, "utf8");

  const relative = path.relative(process.cwd(), path.join(dir, fileName));
  const links = email.links.length > 0 ? ` · ${email.links.join(" ")}` : "";
  console.info(`[dev-outbox] "${message.subject}" til ${message.to} → ${relative}${links}`);
}
