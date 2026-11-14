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
```
