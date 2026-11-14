# Ølklubben verification map

The maintained source for driving Ølklubben's user-facing features on a verify instance. Read this
index, then the feature file for what you drive. Harness facts (commands, isolation, evidence) are in
`.claude/flow/profile.md` → Verify; the harness itself in `scripts/verify/` (README there).

## Baseline preconditions

- An instance started by this run: `npm run verify:up -- --id <id>` printed `READY <id> <url>`, and
  `npm run verify:doctor -- --id <id>` printed `DOCTOR OK`.
- The instance's database holds exactly the seed (`prisma/seed.ts`, constants in
  `scripts/verify/fixtures.ts`, full tables in README.md "Testbrugere"). Every seed user's password is
  `olklubben123`.
- Event and poll dates are relative to the day `up` ran (Europe/Copenhagen). Assert on titles and
  relative wording, not on calendar dates.
- Never drive an instance this run did not start, and never the user's dev server on port 3000.

## Driving conventions

- Drive through `scripts/verify/driver.ts`: `openApp(id, { as, viewport })` gives a logged-in
  Playwright page (`as: null` = logged out). Check scripts: profile → Check script.
- The UI is Danish. Prefer roles plus Danish accessible names
  (`getByRole("button", { name: "Gem min stemme" })`), then labels; never CSS classes or positions.
- Read saved state back with `app.sql(...)` against the instance's own database (tables and columns
  are snake_case, e.g. `beer_ratings.value`), not only from the screen.
- Use `viewport: "mobile"` (375 px) for anything layout-related: the desktop sidebar becomes a top
  bar plus the bottom nav "Hovednavigation".
- Opening a club records it as the user's last active club, which decides where their next login
  lands. Open Torsdagsklubben as Mads, not Kaptajnen, unless that is what you test.
- A mutation changes the instance for the rest of its life. Use your own instance id per task and
  per BEFORE/AFTER; never "undo" by writing to the database.

## Proof and skip reporting

- Proof = the user action, the state read back (page and database), a screenshot via `app.shot()`,
  and no `PROBLEM` lines from the driver.
- Report an unreachable path with the step that failed and the missing precondition. Do not report a
  feature as verified through a different entry point than the one asked about.

## Features

| Feature               | File                       | Smoke journey |
| --------------------- | -------------------------- | ------------- |
| Login and logout      | [login.md](login.md)       | `login:`      |
| Overblik (club home)  | [overview.md](overview.md) | `overview:`   |
| Events                | [events.md](events.md)     | `events:`     |
| Ølkatalog and ratings | [beers.md](beers.md)       | `beers:`      |
| Afstemninger (polls)  | [polls.md](polls.md)       | `polls:`      |
| Sangbog               | [songs.md](songs.md)       | `songs:`      |

Not mapped yet (add a file and a smoke journey when a task touches them): Kalender, Steder,
Klubbens side and members, Profil (nickname, password, email), invitations and join, onboarding and
the club picker, Feedback, the songbook PDF import, the poll cron.

## Feature entry contract

Each feature file starts with an H1 and one paragraph on what the user sees, then exactly these H2s
in this order: `Sub-features`, `How to get to it (user POV)`, `Driving it with the verify driver`,
`Gotchas`. User paths, handles, required state and observable proof only; no implementation details.
