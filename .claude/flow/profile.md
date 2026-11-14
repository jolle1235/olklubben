# Flow profile: Ølklubben

Read by the shared flow skills (`deliver` and its stages, from the private repo
`jolle1235/agent-skills`). Template and section meanings:
`.claude/skills/deliver/references/profile-template.md`. Headings stay in English because the skills
look them up by name. SPEC.md stays the source of truth: where this file and SPEC disagree, SPEC
wins; fix this file.

## Repo

- Base branch: `master`
- PR base: `master`
- Public repo: yes. Only synthetic data on GitHub. Never real song lyrics or titles anywhere in the
  repo, PRs, screenshots or Artifacts (SPEC §19.1 rule 10, D-120).
- `gh` account: `jolle1235` (if `gh` fails with "must be a collaborator": `GH_TOKEN="$(gh auth token --user jolle1235)"`)
- Language: UI text and documentation in Danish; code, routes and identifiers in English. Briefs,
  plans and PR text in Danish.
- Read first: `SPEC.md` §19.1–19.5 (working rules, status, decision log, mistakes, known issues),
  plus the SPEC sections the task touches. §15.1 is the Definition of Done.

## Verify

The harness lives in `scripts/verify/` (README there). Every instance is its own git worktree,
database and port, so BEFORE, AFTER and the `merge-verdict` reviewers can run side by side.

- Harness: `scripts/verify/` (`cli.ts` up/doctor/smoke/down/list, `driver.ts`, `fixtures.ts`)
- Feature map: `.claude/flow/features/` (README index + one file per feature)
- Fixtures: the seed `prisma/seed.ts`, run by `up` against the instance's database; fixed ids and
  names for checks in `scripts/verify/fixtures.ts`, listed in `scripts/verify/README.md`
- Up: `npm run verify:up -- --id <id> [--ref <sha>]` (working tree when `--ref` is left out). Prints
  `READY <id> <url>` once the database is seeded and the mapped pages answer (~15 s). The same id
  again reuses the instance and re-syncs the working tree into it (next dev hot-reloads).
- Doctor: `npm run verify:doctor -- --id <id>` (prints `DOCTOR OK <id> <url>`)
- Smoke: `npm run verify:smoke -- --id <id>` (one journey per feature file, ends with `RESULT PASS`)
- Down: `npm run verify:down -- --id <id>`; all: `npm run verify:down -- --all`; list: `npm run verify:list`
- Driver: `scripts/verify/driver.ts` → `openApp(id, { as, viewport, evidence })`, `createReport()`
- Private data: none. Instances only ever have the synthetic seed; never point one at the dev or
  production database, and never run `songbook:import` against one.
- Isolation: worktree in `~/.cache/olklubben-verify/<id>/app` (outside the repo, hard-linked
  `node_modules`, no `.env` files), database `olklubben_verify_<id>` on the local Postgres, first free
  port in 3200–3299, own outbox. Several instances run at once (proven with two side by side,
  2026-11-14). Never touches `olklubben_dev`, `_test` or `_itest`.
- Evidence: `.flow/verify/<id>/` (smoke screenshots, `server.log` copied by Down) and the task's
  `.flow/<slug>/evidence/`; gitignored, kept by Down.
- Gotchas:
  - Ids: `a-z`, `0-9`, `-`, at most 40 characters. Use `<slug>-before` / `<slug>-after`.
  - A `--ref` instance runs that commit's own migrations and seed. If the seed changed since, the
    constants in `fixtures.ts` may not match it; check the old `prisma/seed.ts`.
  - A working-tree instance runs what was synced at the last `up`. Edit, then `up` the same id again
    before driving; it doesn't watch the repo.
  - `next dev` compiles a route on its first hit; `up` warms the mapped pages, other routes take 1–3 s
    the first time. Give first visits a generous timeout.
  - Every mutation persists for the instance's life. One instance per task and side; start fresh
    (`down`, then `up`) instead of undoing in the database.
  - Opening a club makes it the user's last active club and decides where their next login lands.
  - Full-page screenshots at 375 px draw the fixed bottom nav where the viewport ended, over content.
    That is the screenshot, not the app.
  - Kill instances with Down, never by process name: `next dev` forks `next-server`, and killing only
    the parent leaves the server running on its port.
  - `node_modules` is hard-linked: never `npm install` inside an instance (it would write through to
    the repo's files).

## Check script

A per-task check is `.flow/<slug>/check.mts` (gitignored, outside `tsc` and eslint), run against an
instance id: `npx tsx .flow/<slug>/check.mts <id> | tee .flow/<slug>/evidence/<before|after>.txt`.
`.mts` because tsx runs `.ts` as CommonJS, where top-level `await` fails. One `report.check` per line
of `## Expected after`, named in the brief's Danish words. It prints `PASS|FAIL <name> | <detail>` and
`PROBLEM <text>` per console error, page error, failed request or 5xx, ends with `RESULT PASS|FAIL`,
and exits 1 on any failure. BEFORE and AFTER run the same file against `<slug>-before`
(`--ref <base sha>`) and `<slug>-after` (working tree), at the same time if you like.

```ts
// npx tsx .flow/<slug>/check.mts <instance-id>
import { expect } from "@playwright/test";

import { createReport, openApp } from "../../scripts/verify/driver";
import { BEERS, CLUBS } from "../../scripts/verify/fixtures";

const id = process.argv[2];
if (!id) throw new Error("Brug: npx tsx .flow/<slug>/check.mts <instance-id>");

const report = createReport();
const app = await openApp(id, {
  as: "jesper",
  viewport: "mobile",
  evidence: ".flow/<slug>/evidence",
});
const { page } = app;

await report.check("<Expected after line, verbatim>", async () => {
  // the path the feature file describes
  await app.goto(`/c/${CLUBS.drengene.id}/beers/${BEERS.mikkeller.id}`);
  await expect(page.getByRole("heading", { level: 1, name: BEERS.mikkeller.name })).toBeVisible();
  const rows = await app.sql<{ value: number }>(
    "SELECT value FROM beer_ratings WHERE beer_id = $1",
    [BEERS.mikkeller.id],
  );
  await app.shot("<name>");
  return `ratings: ${rows.length}`; // the value it saw, printed on the PASS line
});

const problems = app.problems();
await app.close();
report.finish(problems);
```

A check that should outlive the task becomes a normal `e2e/<feature>.spec.ts` (Playwright suite,
port 3100, `olklubben_test`) in the same branch.

## Gates

1. Types: `npm run typecheck`
2. Lint and format: `npm run lint && npm run format:check && npm run check:tokens`
3. Tests: `npm test`; plus `npm run test:integration` when server actions, auth or the database are
   touched; plus the E2E files covering the touched features
4. Static gate: `npx fallow audit --base origin/master`, fixed with the `fallow` skill. Only `fail`
   blocks; CRAP findings without coverage data are warnings, not work (D-161)
5. Songbook title grep (SPEC §19.1 rule 10) before every commit

## Commit

- Gate: `npm run check` and `npx fallow audit --base origin/master` (verdict not `fail`)
- Hooks: none (nothing enforces the gate automatically; run it every time)
- Never stage: `.env*` except `.env.example` and `.env.test`; `.dev-outbox/`, `.next*/`,
  `test-results/`, `src/generated/`, `.flow/`; anything with real song content
- Rules: never loosen `.fallowrc.json` without Jesper's OK. Commit messages follow
  `git log --oneline` (Danish, with D-/F- numbers when SPEC got a log entry).

## Merge

- Command: `gh pr merge <n> --squash --delete-branch`
- After merge: `npm run verify:down -- --all`, `git worktree prune`; make sure no E2E server is still running on port 3100

## After each task

Before publishing, update SPEC.md (rules 2–6 in §19.1):

1. §19.2: a status row for the task (date `ÅÅÅÅ-MM-DD`, what changed, the gates and their numbers).
2. §19.3: a D-entry for every decision or deviation from the spec, and update the spec text itself.
3. §19.4: an F-entry for every mistake, wrong assumption or bug that took more than a few minutes.
4. Never delete log entries; strike outdated ones through with a reference to the new one.

## Stack

- Next.js 16 App Router: read `node_modules/next/dist/docs/` before using an API; `src/proxy.ts` is the middleware.
- Server Actions in `src/server/actions/` return `ActionResult` (`src/lib/action-result.ts`); pages are server components.
- Prisma 7 with the pg adapter on Postgres (Neon in production); always the shared `db` from `src/server/db`.
- Better Auth for sessions (`src/server/auth/`); Auth0 or Google login are optional.
- Every feature authorizes on the server (Definition of Done, §15.1); club isolation is non-negotiable (§4.4): any read or write of club data is scoped to a club the user is a member of.
- Tailwind with the design tokens from `src/styles/tokens` (`npm run tokens`, checked by `check:tokens`); UI primitives in `src/components/ui/`.
- All URL state through `src/lib/routes.ts`; invalid params are ignored, never a 404.
- Loading and 404 rules for `/c/[clubId]` in README "Ruter under /c/[clubId]": no `loading.tsx` directly in `src/app/c/[clubId]/`, a guard layout before every detail skeleton.
- Mobile layout must work at 375 px; keyboard focus moves to the field with the error (§15.2).
- Danish UI text.

## Layers

- Pure domain logic: `src/server/domain/<area>/` (no database, unit-tested)
- Data access and queries: `src/server/<area>/` (beers, clubs, events, places, polls, songs, users, feedback)
- Mutations: `src/server/actions/<area>.ts` (Server Actions: validate → authorize → write → revalidate)
- Validation schemas: `src/lib/validation/`
- Shared pure helpers: `src/lib/`
- UI: `src/components/features/<area>/`, primitives in `src/components/ui/`, routes in `src/app/`

## Canonical homes

| Concern                                  | Home                                                                                               |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Database client                          | `src/server/db/index.ts` → `db` (never a new `PrismaClient`)                                       |
| Session, user, membership checks         | `src/server/auth/session.ts` → `getSession`, `requireUser`, `requireMembership`, `requireClubPage` |
| Server Action results and errors         | `src/lib/action-result.ts` → `ok`, `ActionResult`, `ACTION_ERROR_CODES`                            |
| Links and URL params                     | `src/lib/routes.ts`, `src/lib/search-params.ts`                                                    |
| Safe `?next=` redirects                  | `src/lib/safe-redirect.ts`                                                                         |
| Form data parsing                        | `src/lib/form-data.ts`                                                                             |
| Ids                                      | `src/lib/ids.ts`, `src/lib/validation/id.ts`                                                       |
| Text helpers                             | `src/lib/text.ts`, `src/lib/format/`                                                               |
| Rate limiting                            | `src/server/rate-limit.ts`, `src/server/auth/auth-rate-limit.ts`                                   |
| Cache revalidation                       | `src/server/revalidate.ts`                                                                         |
| Env access                               | `src/env.ts` (Zod-validated; never `process.env` directly)                                         |
| Protected paths                          | `src/lib/protected-paths.ts`                                                                       |
| Dialogs, buttons, empty and error states | `src/components/ui/` (`confirm-dialog`, `submit-button`, `empty-state`, `error-state`, …)          |
| Colours and spacing                      | the tokens in `src/styles/tokens`, never raw values                                                |

## Size hotspots

none recorded yet; add files here when a review flags them.

## Bug-prone edges

- Club isolation: ids from another club must give a real 404 (TG-008), also for members.
- Dates and time zones: Europe/Copenhagen, events overnight and across days, DST changes (E20), "I aften" / "I morgen" / "I gang nu".
- Polls: deadlines, lazy close versus the nightly cron, ties, the last vote closing the poll.
- Roles: the last admin, removed members while the app is open, nicknames shown everywhere.
- Soft 404s from a `loading.tsx` above a page that calls `notFound()`.
- Optimistic toggles that must roll back on error and survive a reload.
- Sorting and search with æ/ø/å, long names that must wrap at 375 px.
- Turbopack dev cache reload loops in E2E (F-013, F-062): clear `.next-e2e/dev`.

## Security sinks

- Authorization: every Server Action and route handler checks the session and club membership/role
  on the server (`requireMembership` etc.); hiding a button is not authorization.
- Club isolation: every Prisma query on club data filters by the club the user belongs to.
- Prisma raw queries (`$queryRaw`, `$executeRaw`) built from input.
- Redirects: `?next=` only through `src/lib/safe-redirect.ts`.
- Auth: Better Auth config, password reset and invite tokens (single use, expiry), rate limits.
- Cron: `/api/cron/close-polls` requires `Authorization: Bearer <CRON_SECRET>`.
- Uploads and images (beer photos): size and content type.
- Secrets in `src/env.ts` reaching client code or logs; anything committed.
- Songbook content (private; never committed, logged or posted).

## Verifier notes

`.claude/flow/verifier-notes.md`: this repo's proof recipes, the task log, and the lessons from
earlier sessions.
