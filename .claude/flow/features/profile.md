# Profil

`/c/<clubId>/profile` (and `/profile` without a club) shows "Din konto" (nickname, real name, email),
"Navn og kælenavn" with "Gem profil" ("Sådan ser de andre dig: Kaptajnen (Jesper Thomsen)"), "Email"
(new email twice plus the current password), "Skift password", links to the club page, places and
Feedback, and "Log ud". A nickname is shown instead of the name everywhere except the member list and
the profile.

## Sub-features

- `profile-name` change name and nickname (at most 40 characters).
- `profile-email` "Skift email": logs other devices out.
- `profile-password` "Skift password": keeps this device, logs the others out.
- `profile-google` connect Google or add a password (not available on instances: no Google).

## How to get to it (user POV)

- Mobile: bottom nav "Profil". Desktop: the user row at the bottom of the sidebar ("Profil: <name>
  <email>").

## Driving it with the verify driver

Preconditions:

- `openApp(id, { as: "jesper" })`: name "Jesper Thomsen", nickname "Kaptajnen".

- **Open.** ``app.goto(`/c/${CLUBS.drengene.id}/profile`)``. h1 "Profil";
  `getByLabel("Navn", { exact: true })` has "Jesper Thomsen";
  `getByRole("textbox", { name: /^Kælenavn/ })` has "Kaptajnen"; `getByRole("region", { name: "Email" })`
  contains "jesper@example.com".
- **Nickname.** As Anders: fill the nickname "Ankeret", choose `getByRole("button", { name: "Gem profil" })`,
  wait for `getByText("Gemt ✓")`; `app.sql("SELECT nickname FROM users WHERE email = $1", [USERS.anders.email])`
  → "Ankeret" (recorded 2026-11-14).
- **Proof.** `app.shot("profile")`.

## Gotchas

- `getByLabel("Kælenavn (valgfrit)")` finds nothing: "(valgfrit)" is a separate part of the label.
  Use `getByRole("textbox", { name: /^Kælenavn/ })`.
- Text fields have a "Ryd feltet" button; two exist on the page, so scope them.
- "Nuværende password" appears in both the Email and the password section; scope by region.
- Changing Kaptajnen's email or password breaks `openApp(id, { as: "jesper" })` for the rest of the
  instance (it logs in with the seed credentials). Use Anders, or a fresh instance.
