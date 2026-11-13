---
name: verify
description: Drive the project's real app the way a user does and capture proof, on an isolated instance started from the project's own verify harness (profile → Verify). Covers launch, doctor, driving with the project's driver and feature map, evidence rules and cleanup. Use whenever a change has to be proven on the real app, to reproduce a bug, or for before/after evidence; before-after and merge-verdict build on it.
---

# Verify

Every project-specific fact comes from `.claude/flow/`: `profile.md` (section `## Verify` and
`## Check script`), the feature map it names, and `verifier-notes.md`. This skill holds only the
rules that are the same everywhere. No `## Verify` in the profile, or it says "none"? Stop and run
`setup-verify`.

Read before the first drive in a session:

1. profile → Verify: the up, doctor, smoke and down commands, the driver, fixtures, private data,
   and its `Gotchas`.
2. The feature map's index and the feature files for the features you will drive.
3. The `## Lessons` in `verifier-notes.md`: what earlier runs got wrong in this app.

## Launch

Start an instance with profile → Verify → Up and an id of your own (`<slug>-before`,
`<slug>-after`, `verdict-<role>-<round>`). Run the working tree unless a commit is named (`--ref
<sha>` for BEFORE). Ready means usable: the command returns after the data is seeded and the pages
answer, not when a process is up.

- Never drive an instance this run did not start, and never the user's own dev server.
- If the harness cannot isolate (one fixed port, one database), say so and run instances one after
  another, never side by side.

## Doctor

Run profile → Verify → Doctor before the first drive and again after anything surprising (a failed
drive, a page that looks wrong, a timeout). Do not drive an instance whose doctor fails; fix or
restart it. A doctor failure caused by the harness being out of date is drift: report it and
suggest `update-verify`.

## Drive

- Use the driver from profile → Verify → Driver and the template in profile → Check script.
- Follow the feature file for the path: its entry points, handles and gotchas. Prefer roles,
  labels and visible text over CSS and positions; name a positional selector as a last resort.
- Drive the real user path: no internal setters, test-only routes or direct database writes to
  create the state under test.
- Read saved state back (through the API or the database the harness exposes), not only from the
  screen. Wait for debounced or optimistic saves before reading.
- Per-task checks live in `.flow/<slug>/` (or where profile → Check script says) and are not
  committed unless the profile says so.

## Evidence

- Proof = the action, the resulting state read back, and a screenshot or transcript, with no
  console errors, page errors or failing requests unless the check is about them.
- Evidence goes where profile → Verify says, and must survive cleanup.
- profile → Repo → Public repo: yes → only fixture runs may be quoted in a PR, comment or commit.
  Runs on private data (profile → Verify → Private data) report counts and pass/fail, never content.
- Report an unreachable path with the step that failed and the missing precondition. Never report
  a feature as verified through a different entry point than the one asked about.

## Cleanup

profile → Verify → Down for every instance this run started, after its last drive. Kill only what
the run started, never by process name. Evidence stays.

## Write down what you learned

When the run taught something the next session should know, append one line to `## Lessons` in
`verifier-notes.md` before finishing:

```
<date> | <task slug or "verify"> | <what went wrong or was misunderstood> → <what to do instead>
```

Examples: a selector that matched the wrong element, a wait that was needed, a gotcha missing from
the feature file, a check that could not fail. When the lesson belongs in a feature file or in
profile → Verify → Gotchas, fix it there in the same branch and say so in the line.
