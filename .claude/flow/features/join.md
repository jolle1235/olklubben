# Invitations and join

A club has one active invitation code (shown as "BAJE-R234") and link (`/join/BAJER234`). A logged-in
non-member who opens the link sees "Du er inviteret til <klub>" with "Join klub" and lands on the
club's Overblik after joining. A logged-out visitor sees "Du er inviteret til en ølklub 🍺" with
"Opret konto" and "Log ind"; the link survives signup and login, so they come back to the join page.

## Sub-features

- `join-member` a logged-in non-member joins with "Join klub".
- `join-new-user` logged out: "Opret konto" (or "Log ind") → back on the join page → "Join klub".
- `join-share` the club page shows the code and the link, with "Kopiér link" and "Del" (see club.md).
- `join-new-code` an admin's "Generér ny kode" revokes the old code (see club.md).

## How to get to it (user POV)

- Open a link `/join/<code>` (from a chat, in practice).
- Logged in: Onboarding or the club picker → "Opret eller join ny klub" → enter the code.

## Driving it with the verify driver

Preconditions:

- Torsdagsklubben's code is `CLUBS.torsdag.inviteCode` (`TRSDAG78`); Anders is not a member.
  Drengene & Bajere's is `BAJER234`; all three seed users are members.

- **Invitation.** `openApp(id, { as: "anders" })`, ``app.goto(`/join/${CLUBS.torsdag.inviteCode}`)``:
  `getByRole("heading", { level: 1, name: "Du er inviteret til Torsdagsklubben" })` and
  `getByRole("button", { name: "Join klub" })`.
- **Join.** Choose "Join klub". The URL becomes `/c/<CLUBS.torsdag.id>`; read back with
  `app.sql("SELECT m.role FROM memberships m JOIN users u ON u.id = m.user_id WHERE u.email = $1 AND m.club_id = $2", [USERS.anders.email, CLUBS.torsdag.id])`
  → `MEMBER`.
- **New user.** `openApp(id, { as: null })`, ``app.goto(`/join/${CLUBS.drengene.inviteCode}`)``:
  h1 "Du er inviteret til en ølklub 🍺". `getByRole("link", { name: "Opret konto" })` → URL
  `/signup?next=%2Fjoin%2FBAJER234`. Fill "Navn", "Email", `getByLabel("Password", { exact: true })`,
  "Gentag password", choose `getByRole("button", { name: "Opret konto" })`. Back on `/join/BAJER234`,
  now with h1 "Du er inviteret til Drengene & Bajere"; "Join klub" → the club's Overblik.
- **Proof.** `app.shot("join")`. Both journeys recorded 2026-11-14 (`.flow/setup-verify/map-check2.mts`,
  `join-check.mts`).

## Gotchas

- Logged out, `/join/<code>` does not redirect to `/login`; it shows a teaser page with its own
  "Opret konto" and "Log ind" links.
- A member opening their own club's link is not shown "Join klub"; use a non-member (Anders for
  Torsdagsklubben) or a fresh signup.
- Joining changes the club's member count for the rest of the instance (Overblik's "Inviter dine
  ølbrødre", poll "x af y har stemt").
- Use `@example.test` emails for new users; rate limiting is off on instances.
