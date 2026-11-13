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

**Interim:** there is no isolated verify harness yet. Until there is, the Playwright E2E setup is
the instance (the shared `verify` skill has the rules, this section the facts): `next dev` on port 3100 against `olklubben_test` (`.env.test`, refuses any database
whose name doesn't end in `_test`). Only one instance can run at a time, so BEFORE and AFTER run one
after the other, never in parallel, and reviewers in `merge-verdict` share it in turn.
Build the real harness with `/setup-verify` (isolated port and database per id, in the project's
code), then replace this section.

- Harness: none yet (`/setup-verify` builds it); interim: Playwright (`playwright.config.ts`, `e2e/`)
- Feature map: none yet (`/setup-verify` seeds `.claude/flow/features/`); interim: `e2e/*.spec.ts` and the table under "Tests" in `README.md`
- Fixtures: none committed; each test creates its own users and clubs through the UI (`e2e/fixtures.ts`, `e2e/support/`)
- Up (working tree): nothing to do; Playwright starts the server (stop a server already on port 3100 that runs other code)
- Up (`--ref <sha>`): `git worktree add .flow/<slug>/base <sha> && ln -s "$PWD/node_modules" .flow/<slug>/base/node_modules && (cd .flow/<slug>/base && npx prisma generate)`, then run the check from that folder
- Doctor: `curl -fsS http://localhost:3100/api/auth/ok`
- Smoke: `npx playwright test e2e/smoke.spec.ts e2e/round4-dod.spec.ts`
- Down: stop the Playwright server; `git worktree remove --force .flow/<slug>/base`; all: `git worktree prune`
- Driver: `@playwright/test` with `e2e/fixtures.ts` (`test`, `openPage`) and `e2e/support/*`
- Private data: none (local dev database only; never production)

## Check script

Until the harness exists, the check is a Playwright spec at `e2e/_flow-<slug>.spec.ts`
(inside `testDir`, gitignored by `/e2e/_flow-*`; keep a copy in `.flow/<slug>/`). Run it with
`npx playwright test e2e/_flow-<slug>.spec.ts > .flow/<slug>/evidence/<before|after>.txt`; for
BEFORE, copy it into the base worktree's `e2e/` and run it from there. One `test` per line of
`## Expected after`, named in the brief's Danish words; Playwright's list reporter prints the value
it saw on a failure.

```ts
import { expect } from "@playwright/test";
import { test } from "./fixtures";

test("<Expected after line, verbatim>", async ({ page }) => {
  // drive the path the brief describes; follow the nearest e2e/*.spec.ts for signup and club setup
  await expect(page.getByRole("heading", { name: "…" })).toBeVisible();
});
```

If the check should outlive the task, rename it to a normal `e2e/<feature>.spec.ts` in the same
branch.

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
- After merge: `git worktree prune`; make sure no E2E server is still running on port 3100

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
