# Flow profile: <project name>

<!--
Copy to `.claude/flow/profile.md` in the project and fill in every section.
The shared flow skills (deliver and its stages, verify, setup-verify, update-verify) read this
file instead of hardcoding project names. It is the only place for project-specific rules, together
with the files it points to in `.claude/flow/` (feature map, verifier notes); never add a
project-local skill. They refer to sections as "profile → <Section>". Keep the headings as they are;
write "none" where a section does not apply.
-->

## Repo

- Base branch: `main`
- PR base: `main`
- Public repo: yes | no (yes → only synthetic/fixture evidence may be quoted on GitHub)
- `gh` account: <owner login, if `gh` needs `GH_TOKEN="$(gh auth token --user <owner>)"`, else "default">
- Language: <e.g. user-facing text in Danish; code, routes and identifiers in English>
- Read first: <project docs every stage reads besides CLAUDE.md, e.g. SPEC.md §19>

## Verify

How a stage starts an isolated instance of the real app and drives it. The shared `verify`
skill reads this section; `setup-verify` writes it and the harness, `update-verify` keeps both
honest. No harness yet: "none" (then `deliver` offers `setup-verify`).

- Harness: `<where the harness code lives, e.g. scripts/verify/>`
- Feature map: `.claude/flow/features/` (README index + one file per feature)
- Fixtures: `<path to synthetic seed data>`
- Up: `<command> --id <id> [--ref <sha>]` (working tree when `--ref` is left out)
- Doctor: `<command> <id>`
- Smoke: `<command> <id>`
- Down: `<command> <id>`; all: `<command>`
- Driver: `<module the check script imports>`
- Private data: <how a run uses production-like data, e.g. `--data snapshot`, or "none">
- Isolation: <what keeps instances apart (own worktree, port, database), and whether several can run at once>
- Evidence: <where screenshots and logs go; they survive Down>
- Gotchas: <what a driver must know that the code doesn't say: first-run downloads, waits, expected noise>

## Check script

The template `before-after` writes to `.flow/<slug>/check.mjs`. It takes an instance id, prints
one `PASS|FAIL <name> | <detail>` line per expectation and `PROBLEM <text>` per console/page/API
problem, and exits 1 on any failure.

```js
// node .flow/<slug>/check.mjs <instance-id>
```

## Gates

Commands for the clean stage, in order. All must pass.

1. Types: `<command>`
2. Lint: `<command on changed files>`
3. Tests: `<command>`
4. Static gate: `<command>`, fixed with the `<skill>` skill, or "none"

## Commit

- Gate before every commit: `<command(s)>`
- Hook that enforces it: `<path>`, or "none"
- Never stage: `<globs, e.g. .env*, build output>`
- Rules: <project-specific commit rules, e.g. baseline files never regenerated>

## Merge

- Command: `gh pr merge <n> --squash --delete-branch`
- After merge: <cleanup, e.g. stop all verify instances>

## After each task

Project bookkeeping `deliver` does before publishing, or "none".
(e.g. "Update SPEC.md §19.2 status; log mistakes in §19.4 and spec deviations in §19.3.")

## Stack

Rules reviewers and planners check, one line each (framework idioms, data access, state, styling).

## Layers

Where each kind of code lives (data access, API clients, server state, pure logic, UI).
`solid-check` judges "one reason to change" against this.

## Canonical homes

| Concern | Home |
|---|---|

New code that re-derives something listed here is a blocker in `thermonuclear-review`.

## Size hotspots

Files already too large; a change there should shrink them, not grow them. Or "none".

## Bug-prone edges

What the `bugs` reviewer probes in this app (dates and time zones, optimistic updates, ...).

## Security sinks

Where request input can do harm here (database queries, server-side fetch, HTML, uploads,
secrets, auth checks), and the helper that must guard each.

## Verifier notes

`.claude/flow/verifier-notes.md` (from `verifier-notes-template.md`): the project's proof recipes,
the task log, and the lessons: what failed or was misunderstood in earlier sessions.
