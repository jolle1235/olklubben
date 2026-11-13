---
name: setup-verify
description: Give a project a scripted way to drive its real app the way a user does - an isolated-instance harness in the project's code (up, doctor, smoke, down, a driver, synthetic fixtures), the profile's Verify section, a feature map in .claude/flow/features/ and an empty verifier-notes.md - and prove it end to end once. Never creates a project skill; the shared `verify` skill reads what this writes. Use when profile → Verify is missing or "none", or when asked to "set up verification" for a repo.
disable-model-invocation: true
---

# Set up verification

Adapted from pstack's `create-verification-skill` (MIT, Copyright (c) 2026 Lauren Tan; see
`LICENSE`). The difference: nothing project-specific becomes a skill. The output is code in the
project plus files in `.claude/flow/`, and the shared `verify` skill reads them.

| Output | Where |
|---|---|
| Harness: up, doctor, smoke, down, driver | project code, e.g. `scripts/verify/` + package scripts |
| Synthetic seed data | project code, e.g. `scripts/verify/fixtures/` |
| Commands, isolation, evidence paths, gotchas | `.claude/flow/profile.md` → `## Verify` and `## Check script` |
| What a user can do, and how to drive it | `.claude/flow/features/` (README index + one file per feature) |
| Recipes, task log, lessons | `.claude/flow/verifier-notes.md` (from `deliver/references/verifier-notes-template.md`) |

You write for the next agent, not for a human: it reads these cold, mid-task, and has never seen
the app.

## 1. Interview the repo, not the user

Answer these from the codebase; ask the user only what you cannot observe:

- **Surface:** what does a user touch? Web UI, CLI/TUI, desktop app, API, mobile app, library.
  Pick the primary one and note the rest.
- **Run:** how does the app start locally (package scripts, Makefile, README)? Ports, env vars,
  databases, migrations, seed data, auth.
- **Drive:** existing harnesses first (Playwright/Cypress specs, E2E fixtures, PTY helpers,
  curl-able endpoints); then a generic recipe: a browser for web, a PTY for CLI, HTTP for services.
- **Observe:** screenshots, transcripts, response bodies, logs, exit codes, database state.
- **Isolate:** can two instances run side by side (own port, own database, own working copy)? Aim
  for yes: BEFORE and AFTER, and the `merge-verdict` reviewers, all run at once. If not, write it in
  profile → Verify so every stage runs instances one after another.
- **Data:** the app must never touch a real or shared database. Prefer a throwaway database per
  instance (in-memory, a container, a database name with the instance id) seeded with synthetic
  fixtures. A private copy of production, if wanted, is opt-in and never committed.

If the checkout doesn't build or start as-is, fix that first or report it precisely.

## 2. Build the harness

In the project's code, with the project's tools and language:

- **Up** `--id <id> [--ref <sha>]`: runs the working tree, or a given commit from a throwaway git
  worktree, against a fresh seeded database, on a free port. Returns only when usable (data seeded,
  main pages answer) and prints the instance's URL. The same id twice reuses the instance.
- **Doctor** `<id>`: read-only; passes only when the process is ours and alive, the database is
  the instance's own, and the app really reads it. No real secrets or `.env` files in play.
- **Smoke** `<id>`: drives every feature in the map once, read-only, and fails on missing content
  or errors.
- **Down** `<id>` / `--all`: kills only the recorded processes, removes the worktree, keeps
  evidence.
- **Driver**: one module a check script imports to open the app logged in (if the app has auth),
  navigate, take screenshots, read state back, and return the problems it saw (console errors, page
  errors, failing requests).
- **Fixtures**: small, synthetic, with fixed ids and names a check can rely on; a README listing them.

Every command is runnable as a package script and shown in profile → Verify. A helper the reader
has to reverse-engineer is not a helper.

## 3. Fill profile → Verify and → Check script

Use the shape in `deliver/references/profile-template.md`. Real commands, no placeholders. Under
`Gotchas`, write what a driver must know that the code doesn't say: first-run downloads, waits for
toasts or debounced saves, expected noise on private data.

## 4. Seed the feature map

`.claude/flow/features/README.md` plus one file per user-facing feature (start with the top 3–5,
from routes, commands, menus or docs). Follow the shape in
[`references/feature-map-example/`](references/feature-map-example/). Each file: an H1, one
paragraph on what the user sees, then exactly these H2s: `Sub-features`, `How to get to it (user
POV)`, `Driving it with <driver>`, `Gotchas`. User paths, handles, required state and observable
proof only; no implementation details. If the fixtures lack a precondition, the journey reports a
failure and the reason goes in `Gotchas`; never weaken the journey to make it pass.

## 5. Create the notes file

Copy `deliver/references/verifier-notes-template.md` to `.claude/flow/verifier-notes.md`, and point
profile → Verifier notes at it.

## 6. Prove it before handing it over

Follow the `verify` skill end to end once: up, doctor, drive ONE mapped feature, capture evidence,
down. Then confirm the evidence still exists. Also start two instances at once to prove isolation
(or record in the profile that it can't). Run down after every failed attempt too. A harness that
was never executed is a draft.

## 7. Hand over

Commit through the `commit` skill on a branch, and point the user at `update-verify` for keeping
the map and harness honest as the app changes.
