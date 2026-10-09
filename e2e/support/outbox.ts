import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { expect } from "@playwright/test";

import { e2eOutboxDir } from "../test-env";

/** A mail written by the E2E server to the dev outbox (D-024, src/server/email/send-email.ts). */
export type OutboxEmail = {
  id: string;
  to: string;
  from: string;
  subject: string;
  text: string;
  html?: string;
  createdAt: string;
  links: string[];
};

async function readOutbox(): Promise<OutboxEmail[]> {
  let files: string[];
  try {
    files = await readdir(e2eOutboxDir);
  } catch {
    return [];
  }
  const emails = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => {
        try {
          return JSON.parse(await readFile(path.join(e2eOutboxDir, file), "utf8")) as OutboxEmail;
        } catch {
          return null; // Still being written.
        }
      }),
  );
  return emails.filter((email): email is OutboxEmail => email !== null);
}

/**
 * Waits for the newest mail to `to`. Reset mails are written after the HTTP
 * response (D-031), so this polls. Every test uses its own email address, so
 * tests running in parallel never read each other's mails.
 */
export async function waitForEmail(to: string, subject?: RegExp): Promise<OutboxEmail> {
  let found: OutboxEmail | undefined;
  await expect
    .poll(
      async () => {
        const matches = (await readOutbox())
          .filter((email) => email.to === to.toLowerCase() || email.to === to)
          .filter((email) => !subject || subject.test(email.subject))
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        found = matches.at(-1);
        return found !== undefined;
      },
      { message: `mail til ${to} i ${e2eOutboxDir}`, timeout: 20_000 },
    )
    .toBe(true);
  return found as OutboxEmail;
}

/** The /reset-password?token=… link in a reset mail, as a path for page.goto(). */
export function resetPathFrom(email: OutboxEmail): string {
  const link = email.links.find((url) => url.includes("/reset-password?token="));
  if (!link) throw new Error(`E2E: ingen nulstillingslink i mailen "${email.subject}"`);
  const url = new URL(link);
  return `${url.pathname}${url.search}`;
}
