---
name: before-after
description: Prove a change with one check run twice on the real app - on the base commit (BEFORE) and on the change (AFTER) - using the project's isolated verify instances. Bugs and features go red to green; refactors must print identical output. Covers the proof script, red-first unit tests, the implementation in between, smoke for regressions, and the feature map. Use when implementing any task that changes code, to reproduce a bug before fixing it, or when asked to "prove it", "show before and after". Stage 5 of `deliver`.
---

# Before / after

One script, two runs, one comparison. The BEFORE run shows the problem (or pins the behaviour a
refactor must keep); the AFTER run shows the brief is met. Read
`.claude/skills/principle-prove-it-works/SKILL.md` first, plus
`principle-fix-root-causes` for a bug and `principle-test-behavior-not-implementation` when
writing tests.

Commands come from `.claude/flow/profile.md` (see `deliver`): `<up>`, `<doctor>`, `<smoke>` and
`<down>` are profile → Verify, `<tests>` is profile → Gates → Tests.

## Inputs

- `.flow/<slug>/brief.md`: type and `## Expected after`.
- `.flow/<slug>/plan.md`: `## Proof` (from the plan, or from `find-verifier`).
- The base SHA: `state.json` → `base`, else `git merge-base origin/<base branch> HEAD`.

## 1. Write the check

`.flow/<slug>/check.mjs` starts from profile → Check script. It takes an instance id and prints one
stable line per expectation, `PASS|FAIL <name> | <detail>`, then `PROBLEM <text>` for each
console, page or API problem the driver saw, and exits 1 if anything failed.

- One expectation per line of `## Expected after`, named in the brief's words.
- Print values, not only verdicts (`detail`), so a diff of two runs explains itself.
- **Refactor:** print the normalised characterization output instead (no ids, no timestamps) and
  always exit 0; the proof is that BEFORE and AFTER print the same thing.
- Not a UI task? The check can be a unit test file or a replay script from the verifier catalog.
  Same rules: one run on base, one on the change, saved to `evidence/`.

## 2. BEFORE, on the base commit

```bash
<up> --id <slug>-before --ref <base>
<doctor> <slug>-before
node .flow/<slug>/check.mjs <slug>-before > .flow/<slug>/evidence/before.txt; echo "exit $?" >> .flow/<slug>/evidence/before.txt
<smoke> <slug>-before > .flow/<slug>/evidence/smoke-before.txt
<down> <slug>-before
```

Expected: **bug / feature** exits 1 with the brief's problem visible in the output; **refactor**
exits 0. If a bug's check passes on base, the check does not reproduce the bug. Do not implement:
rework the check or run `find-verifier`. Proving the check can fail is part of the job.

## 3. Unit test first, where logic is pure

When the root cause sits in a pure function, write the test, run it on the unchanged code and save
the failure (`evidence/unit-before.txt`). It goes in the same commit as the fix.

## 4. Implement

Follow the plan's steps. Fix the cause where it starts, not where it shows up. When user-visible
behaviour changes, update the feature file (profile → Verify → Feature files) in the same branch,
and add fixture data (profile → Verify → Fixtures) if the check needs it.

## 5. AFTER, on the change

```bash
<up> --id <slug>-after          # working tree, including uncommitted files
node .flow/<slug>/check.mjs <slug>-after > .flow/<slug>/evidence/after.txt; echo "exit $?" >> .flow/<slug>/evidence/after.txt
<smoke> <slug>-after > .flow/<slug>/evidence/smoke-after.txt
<down> <slug>-after
diff .flow/<slug>/evidence/before.txt .flow/<slug>/evidence/after.txt
```

Pass when: the check exits 0 (refactor: before and after are identical), smoke has no failure or
problem that BEFORE did not have, and `<tests>` passes.

## 6. Record

Write to `state.json` → `proof`: `{ "before": "red" | "pinned", "after": "green" | "identical",
"evidence": [...] }`. Later fix rounds re-run only AFTER; BEFORE is captured again only when
`check.mjs` changed or the base moved over files the check covers.

The PR quotes `before.txt` and `after.txt` from **fixture** instances only. A run on private data
(profile → Verify → Private data) is an extra local check: report "passed on private data (N items)",
never its content.
