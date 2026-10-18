/**
 * Toasts after a redirect ("flash" messages). A Server Action that redirects
 * cannot return a result to the client (and must work without JavaScript),
 * so it adds `?toast=<key>` to its redirect target with withToast(). The root
 * layout's <FlashToast /> shows the matching message once and removes the
 * flag from the address bar (src/components/features/flash-toast.tsx), so it
 * also works outside a club, e.g. on /onboarding after leaving the last club
 * (D-104).
 *
 * Only these known keys are shown, so a link can never put arbitrary text in
 * a toast. Messages follow the tone of SPEC §13.5. Pure and client-safe.
 */

export const TOAST_PARAM = "toast";

export const FLASH_TOASTS = {
  "event-created": "Skål! Eventet er oprettet 🍻",
  "event-updated": "Gemt ✓",
  "event-deleted": "Eventet er slettet.",
  "event-deleted-beers-kept": "Eventet er slettet. Øllene er stadig i kataloget 🍺",
  "beer-created": "Skål! Øllen er tilføjet 🍺",
  "beer-updated": "Gemt ✓",
  "beer-deleted": "Øllen er slettet.",
  "place-created": "Stedet er oprettet 📍",
  "place-updated": "Gemt ✓",
  "place-archived": "Stedet er arkiveret. De gamle events viser det stadig.",
  "place-restored": "Stedet er gendannet.",
  "place-deleted": "Stedet er slettet.",
  "song-created": "Sangen er tilføjet 🎵",
  "song-updated": "Gemt ✓",
  "song-deleted": "Sangen er slettet.",
  "poll-created": "Afstemningen er klar 🗳 Del linket med klubben.",
  "poll-updated": "Gemt ✓",
  "vote-saved": "Skål! Din stemme er gemt ✓",
  "vote-saved-closed": "Skål! Din stemme er gemt ✓ Alle har stemt, og eventet er oprettet 🎉",
  "vote-saved-tie": "Skål! Din stemme er gemt ✓ Alle har stemt – men der er uafgjort 🤝",
  "poll-locked": "Afstemningen er lukket 🔒",
  "poll-closed": "🎉 Afstemningen er afsluttet, og eventet er oprettet!",
  "poll-awaiting": "Afstemningen er lukket – der er uafgjort 🤝",
  "poll-decided": "🎉 Vinderen er valgt, og eventet er oprettet!",
  "poll-cancelled": "Afstemningen er annulleret.",
  "profile-updated": "Gemt ✓",
  "password-changed": "Dit password er skiftet. Dine andre enheder er logget ud.",
  "club-updated": "Gemt ✓",
  "club-left": "Du har forladt klubben.",
  "club-deleted": "Klubben er slettet.",
  "feedback-created": "Tak! Din rapport er gemt 🍻",
  "feedback-updated": "Gemt ✓",
  "feedback-deleted": "Rapporten er slettet.",
  "feedback-moderated": "Status er gemt ✓",
} as const satisfies Record<string, string>;

export type FlashToastKey = keyof typeof FLASH_TOASTS;

/** The message for a `?toast=` value, or null for a missing or unknown key. */
export function flashToastMessage(key: string | null | undefined): string | null {
  if (!key || !Object.hasOwn(FLASH_TOASTS, key)) return null;
  return FLASH_TOASTS[key as FlashToastKey];
}

/** `href` with `?toast=<key>` (keeps an existing query and #hash). */
export function withToast(href: string, key: FlashToastKey): string {
  const hashIndex = href.indexOf("#");
  const path = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : href.slice(hashIndex);
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${TOAST_PARAM}=${encodeURIComponent(key)}${hash}`;
}

/** `search` ("?a=1&toast=x" or "") without the toast flag, as "?a=1" or "". */
export function searchWithoutToast(search: string): string {
  const query = new URLSearchParams(search);
  query.delete(TOAST_PARAM);
  const rest = query.toString();
  return rest ? `?${rest}` : "";
}
