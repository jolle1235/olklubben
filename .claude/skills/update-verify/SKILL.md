---
name: update-verify
description: Periodic pass that keeps a project's verification honest - the harness code, profile → Verify, the feature map in .claude/flow/features/ and the lessons in verifier-notes.md - with parallel source readers per feature, one live session driving every feature, and at most one PR of proven corrections. Use for /update-verify, "update the verifier", "audit verification", or when the verify skill or merge-verdict reports drift.
disable-model-invocation: true
---

# Update verification

Adapted from pstack's `maintain-verification-skill` (MIT, Copyright (c) 2026 Lauren Tan; see
`LICENSE`). A feature map rots the moment the app changes. This is the upkeep loop for what
`setup-verify` built. The unit of rigor is the feature: cover every feature file from source and
drive every feature live.

## Outcomes

Pick one, and say which:

- **clean**: every feature got source and live coverage; nothing worth shipping. No branch, no PR.
- **changed**: one PR ships proven corrections.
- **blocked**: coverage could not finish or a proven fix could not ship safely. Say exactly what.

## Edit scope

Only these: the harness code and fixtures (profile → Verify names them), profile → Verify and →
Check script, `.claude/flow/features/`, and `.claude/flow/verifier-notes.md`. Never product code:
a behaviour the map describes that the app no longer does is either doc drift (fix the map) or a
product regression (report it). Never create a project skill; shared rules go to the
`agent-skills` repo as a PR instead.

## Pass

0. **Locate.** Read `.claude/flow/profile.md`. No `## Verify` (or "none")? Stop and point at
   `setup-verify`.

1. **Lessons first.** Read `## Lessons` in `verifier-notes.md`. A lesson that keeps recurring
   becomes a fix: a gotcha in the feature file or profile, a driver helper, a fixture. Mark the
   folded lessons `(folded into <file>)`; never delete lines.

2. **Index hygiene.** Read the feature map README and its sibling files. Fix missing, extra,
   duplicate or dead entries.

3. **Source wave.** One read-only subagent per feature file, launched in one message. Each
   explains how the feature works from source, flags likely drift with citations, and returns one
   live-verification recipe. They never drive the app or edit files. Return shape: summary / source
   entry points / likely drift or none / one recipe.

4. **Reconcile.** Every feature file has a summary. Merge overlapping recipes into as few app
   states as practical. Spot-check cited drift. Sweep recent churn (`git log` since the last update)
   for user-facing surfaces missing from the map; require a concrete source path before calling one
   missing. Check that profile → Stack, → Layers and the dependencies it names still match
   `package.json` (or equivalent).

5. **Live pass.** Required even when the source looks clean. You own all driving, following the
   `verify` skill: doctor before the first drive and after any failure; evidence survives every
   cleanup; nothing a drive started outlives the run. Drive every feature at least once. A feature
   that can't be reached is `verified-unreachable` only with the concrete prerequisite and the route
   attempted. A doctor failure caused by harness drift is drift: fix it under edit scope and retry
   once before calling the pass `blocked`. Re-drive every harness fix before it ships.

6. **Triage.** Wrong or missing user-POV description → fix the map. Working behaviour the harness
   can't drive → fix the harness (runnable as a package script, shown in profile → Verify). Broken
   app behaviour → a product gap: record it for the user, keep it out of this PR. Each fix that a
   future run should know about gets a `## Lessons` line.

7. **Ship or stop.** For changed: one PR through `commit`, re-reading every changed file first. For
   clean or blocked: no PR; report the outcome and the coverage honestly.
