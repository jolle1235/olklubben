import "server-only";

import type { EmailMessage } from "./send-email";

/**
 * Email texts (Danish). Each template returns subject, text and a simple HTML
 * version; the plain text is the source of truth (Gmail shows either).
 */

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** "Glemt password" (SPEC §6.4). The link works for 1 hour and only once. */
export function passwordResetEmail(input: { to: string; name: string; url: string }): EmailMessage {
  const name = input.name.trim() || "der";
  const subject = "Nulstil dit password til Ølklubben";
  const text = [
    `Hej ${name}`,
    "",
    "Nogen (forhåbentlig dig) har bedt om at nulstille dit password til Ølklubben.",
    "",
    "Vælg et nyt password her:",
    input.url,
    "",
    "Linket virker i 1 time og kan kun bruges én gang.",
    "",
    "Har du ikke bedt om det, kan du bare ignorere denne mail. Dit password er ikke ændret.",
    "",
    "Skål! 🍺",
    "Ølklubben",
  ].join("\n");

  const html = `<!doctype html>
<html lang="da">
  <body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #2b1d0e;">
    <p>Hej ${escapeHtml(name)}</p>
    <p>Nogen (forhåbentlig dig) har bedt om at nulstille dit password til Ølklubben.</p>
    <p><a href="${escapeHtml(input.url)}">Vælg et nyt password</a></p>
    <p>Linket virker i 1 time og kan kun bruges én gang.</p>
    <p>Har du ikke bedt om det, kan du bare ignorere denne mail. Dit password er ikke ændret.</p>
    <p>Skål! 🍺<br />Ølklubben</p>
  </body>
</html>`;

  return { to: input.to, subject, text, html };
}
