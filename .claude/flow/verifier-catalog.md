# Verifier catalog (Ølklubben)

Project recipes for the techniques in the shared catalog
(`.claude/skills/find-verifier/references/verifier-catalog.md`). An entry here wins over the shared
one. Add or correct entries only from real runs (see `verifier-log.md`).

Tools: Playwright E2E (`e2e/`, port 3100, `olklubben_test`), Vitest unit (`src/**/*.test.ts`),
Vitest integration against Postgres (`tests/integration/**/*.itest.ts`, `olklubben_itest`), git.

## 5. Unit test, red first

- **Recipe:** `npx vitest run <file>` on the unchanged code, save the failure to
  `.flow/<slug>/evidence/unit-before.txt`, implement, run again.

## 8. Data-state diff / server-side rules

- **Use when:** a Server Action's authorization, club isolation, or what it writes.
- **Recipe:** an integration test in `tests/integration/` that calls the real action;
  `expectNotFound` / `expectRedirect` from `tests/integration/helpers.ts`. Runs one file at a time
  against `olklubben_itest`.

## 11. Fake clock and time zone

- **Recipe:** the E2E config already uses `timezoneId: "Europe/Copenhagen"`; set the time with
  `page.clock.setFixedTime(...)`. `e2e/overview-calendar.spec.ts` has the DST case (E20).
