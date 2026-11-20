# Indstillinger

`/c/<clubId>/settings` (D-183) gathers the account, the club, my clubs and the app in groups (regions
named by their heading): "Konto" (avatar, display name, email → Konto `/profile`), the club's name
("Medlemmer og invitation" with the member count → `/club`, "Steder" with the count → `/places`),
"Mine klubber" (every club, the active one with ✓ and `aria-current`; another opens its Overblik;
"Opret eller join ny klub" → `/onboarding`) and "App" (Udseende, "Feedback (fejl og ønsker)"), then
"Log ud". Klubben, Steder, Konto and Feedback are its subpages: on mobile they have "‹ Tilbage" in the
top bar, back to Indstillinger without history.

## Sub-features

- `settings-switch` switch club by tapping another club under "Mine klubber".
- `settings-appearance` Udseende (System | Lyst | Mørkt), per device (theme.spec.ts).
- `settings-logout` "Log ud" (on desktop also under the sidebar's user row). Also deletes the device's
  Cache Storage (the service worker's cached Overblik, D-185).

## How to get to it (user POV)

- Mobile: the gear in the bottom nav (icons only; named "Indstillinger"). Desktop: the user row at the
  bottom of the sidebar ("Indstillinger: <name> <email>").

## Driving it with the verify driver

Preconditions:

- `openApp(id, { as: "jesper" })`: member of Drengene & Bajere (3 members) and Torsdagsklubben.

- **Open.** ``app.goto(`/c/${CLUBS.drengene.id}/settings`)``. h1 "Indstillinger";
  `getByRole("region", { name: "Konto" })` contains "jesper@example.com";
  `getByRole("link", { name: /Medlemmer og invitation/ })` contains "3 medlemmer";
  `getByRole("region", { name: "Mine klubber" }).getByRole("link", { name: "Drengene & Bajere" })` has
  `aria-current="page"`.
- **Switch club.** Tap "Torsdagsklubben" → `/c/<torsdag>` with h1 "Torsdagsklubben" (Overblik's h1 is
  the club's name). This makes it the last active club; open Drengene & Bajere again afterwards.
- **Proof.** `app.shot("settings")`.
