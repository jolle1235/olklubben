# Verifier notes: Ølklubben

The project's memory for proving changes, across sessions. Read by `find-verifier`, `scope-task`,
`before-after`, `verify` and `update-verify` (profile → Verifier notes). Only append from runs that
happened; never delete lines, strike them through with a pointer instead.

## Recipes

This repo's recipes, numbered like the shared catalog
(`.claude/skills/find-verifier/references/verifier-catalog.md`); where both cover a technique, the
recipe here wins. Tools: the verify harness (`scripts/verify/`, one isolated instance per id, profile
→ Verify), Playwright E2E (`e2e/`, port 3100, `olklubben_test`), Vitest unit (`src/**/*.test.ts`),
Vitest integration against Postgres (`tests/integration/**/*.itest.ts`, `olklubben_itest`), git.

### 1. UI drive on the real app, before and after

- **Use when:** anything a user sees or does in the app.
- **Recipe:** `npm run verify:up -- --id <slug>-before --ref <base sha>` and
  `npm run verify:up -- --id <slug>-after` (both at once is fine), doctor both, then the same
  `.flow/<slug>/check.mts` against each (profile → Check script). Follow the feature file for the
  path; read the result back with `app.sql`. Down both afterwards.
- **Proven:** 2026-11-14, `.flow/setup-verify/check.mts` (Kaptajnen rates Mikkeller 4 on mobile,
  `beer_ratings.value = 8`, survives reload).

### 5. Unit test, red first

- **Recipe:** `npx vitest run <file>` on the unchanged code, save the failure to
  `.flow/<slug>/evidence/unit-before.txt`, implement, run again.

### 8. Data-state diff / server-side rules

- **Use when:** a Server Action's authorization, club isolation, or what it writes.
- **Recipe:** an integration test in `tests/integration/` that calls the real action;
  `expectNotFound` / `expectRedirect` from `tests/integration/helpers.ts`. Runs one file at a time
  against `olklubben_itest`.

### 11. Fake clock and time zone

- **Recipe:** the E2E config already uses `timezoneId: "Europe/Copenhagen"`; set the time with
  `page.clock.setFixedTime(...)`. `e2e/overview-calendar.spec.ts` has the DST case (E20).

## Log

One line per task that chose a verifier (`find-verifier`) or ran `before-after`.

```
date       | task slug | kind | technique | caught something | note
2026-11-14 | setup-verify | chore | 1. UI drive | yes | the harness's own screenshot caused a hydration-mismatch PROBLEM; fixed in the driver (caret: "initial")
2026-11-14 | google-only-auth | feature | 1. UI drive (--google, captured redirect) + 8. data-state (scratch-DB migration itest) | yes | BEFORE showed "Log ind med Google igen" sending prompt=login to Google (F-098), found by plan-critique
```

## Lessons

What failed, was misunderstood or surprised a run, so the next session doesn't repeat it.

```
date       | task | what went wrong or was misunderstood → what to do instead
2026-11-14 | setup-verify | a worktree with a symlinked node_modules fails in Turbopack ("Could not find the Next.js package") → the harness hard-links node_modules (`cp -al`); don't go back to the symlink recipe
2026-11-14 | setup-verify | `next dev` writes `<distDir>/…/types` globs into tsconfig.json → never run an instance in the repo's own tree; the harness runs a copy outside the repo
2026-11-14 | setup-verify | killing the `next dev` parent (timeout, kill <pid>) left `next-server` on the port → only stop instances with `verify:down` (it kills the process group)
2026-11-14 | setup-verify | a full-page screenshot taken before hydration made React report a hydration mismatch (Playwright hides the caret with an inline style) → `app.shot()` uses `caret: "initial"`; don't call `page.screenshot` directly without it
2026-11-14 | setup-verify | `pkill -f "<pattern>"` in a shell command matched the shell itself and killed it → never kill by pattern; use the recorded pid (`verify:down`)
2026-11-14 | setup-verify | HTML escapes "&" (`Drengene &amp; Bajere`), so a raw-HTML `includes()` on a club name failed → assert on text without special characters, or through the driver's locators
2026-11-14 | setup-verify | assumed a logged-out `/join/<code>` redirects to `/login`; it shows its own teaser page ("Du er inviteret til en ølklub 🍺") → check the page before writing the journey (join.md)
2026-11-14 | setup-verify | `getByLabel("Kælenavn (valgfrit)")` matched nothing ("(valgfrit)" is a separate part of the label) → `getByRole("textbox", { name: /^Kælenavn/ })` (profile.md)
2026-11-14 | setup-verify | clicking 👍 on the calendar bug as Anders removed his vote: every seed user has already voted → use a new user to add a vote (feedback.md)
2026-11-14 | google-only-auth | `prisma migrate deploy` from the repo root reads `.env.local`, whose `DIRECT_URL` wins over a `DATABASE_URL` you pass → prove a migration with a scratch-database itest (`remove-auth0-migration.itest.ts`, `round3-migration.itest.ts`), never the CLI against an instance from the root
2026-11-14 | google-only-auth | raw `INSERT INTO accounts` failed: `id` has no database default (Prisma makes the uuid in the client) → give raw inserts `gen_random_uuid()`
2026-11-14 | google-only-auth | a `console.warn` spy set up in `vi.hoisted` had an empty `mock.calls` in the test: the history is cleared before each test, and `@/env` warns at import → collect the calls into your own array in the spy's implementation
2026-11-14 | google-only-auth | smoke run after the check script failed on Mads (the check had removed his password) → run smoke before any check that changes seed users
2026-11-14 | google-only-auth | smoke's beers journey failed 4/4 on base and change alike: the click on a catalogue card landed during hydration and was lost → the driver's `app.goto()` now waits until the page's h1 has React props (not just <body>: a streamed loading.tsx boundary hydrates after the shell); a FAIL also prints Playwright's `Locator:` line
2026-11-16 | event-beer-rating-ux | plan's E2E grep looked for click-then-toHaveURL only; `e2e/events.spec.ts` also asserted the event card's exact `href` → when a link's URL changes, grep `e2e/` for the href builder's output (`toHaveAttribute("href"`) too
2026-11-16 | event-beer-rating-ux | `TastedAt` already links to the event, so a back-link check by name matched two links → match the back link with `exact: true` and its position above the h1
2026-11-16 | ui-add-back-google | a click right after a server-action redirect raced the `?toast=` cleanup (router.replace) and stayed on the page under full-suite load → wait for the toast to leave the URL (`toHaveURL(/…$/)`) before clicking
2026-11-16 | ui-add-back-google | `page.goto` is a full load: anything kept in module state or reset per document (the nav history) starts over → drive in-app history by clicking, and test the full-load case on purpose
2026-11-16 | ui-add-back-google | Next's agent upgrade nudge (`experimental.agentUpgrade`) stops every other `next dev`/`next build` start; the E2E webServer deletes `.next-e2e/dev`, where Next keeps its retry receipt, so Playwright's own start never gets past it → start `next dev --port 3100` by hand with the E2E env (twice), Playwright reuses it
2026-11-16 | ui-add-back-google | `next build` with a custom `NEXT_DIST_DIR` rewrote tsconfig.json (adds its types globs, reflows arrays) → build with the default `.next`, or `git checkout tsconfig.json` afterwards; `next build` also needs `.env.test` sourced in a worktree without `.env`
2026-11-16 | ui-add-back-google | the songbook title grep has no title list in a worktree; the local dev database only holds the 7 synthetic seed songs → say so in the status row instead of claiming "0 fund"
2026-11-16 | ui-add-back-google | the plan's history rule ("the previous page is a step back") passed every planned flow but broke the tasting flow and revisits from another tab; merge-verdict reviewers found both → when a rule generalises over navigation, check it on the app's main flows (event → Tilføj øl → beer → Smagt til → event), not only the case it was written for
2026-11-16 | ui-add-back-google | smoke "beers" failed on a fresh instance of master and the branch alike: a click on a catalogue card right after load sometimes never navigates (1/4 in a loop) → a pre-existing race; compare with a BEFORE smoke run at the same time before blaming the change, and an earlier green smoke is not proof it is stable
2026-11-16 | ui-add-back-google | a check that creates data (6f adds a beer) makes a later smoke on the same instance fail ("9 øl") → run smoke on a fresh instance, or before the check
2026-11-16 | ui-add-back-google | round 2 fixed the reported flow by listing "detour" pages (forms, beers) and the next review found the same bounce via places and polls → name the rule by what does NOT belong (the main pages in the nav), not by the cases seen so far
```
