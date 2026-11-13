---
name: find-verifier
description: Work out how to prove a change when the task is clear but its proof is not. Spawns one read-only agent that picks from the verifier catalog (UI drive, golden replay of recorded inputs, differential run, round-trip, unit test, characterization snapshot, visual diff, data-state diff, logs, performance numbers, fake clock, recorded external input, production build, access matrix, static guarantee) plus the project's own recipes, and returns ranked, runnable proposals. Use when scope-task marks a brief as hard to verify, when plan-critique calls the proof weak, when before-after cannot make BEFORE show the expected failure, or when asked "how do we verify this?".
---

# Find a verifier

A loop is only as good as its verifier. A check that cannot fail, or that watches the wrong
signal, turns every later stage into theatre. This skill makes choosing the verifier a step of its
own, and keeps what worked in a catalog so the next task starts from experience instead of a blank
page.

Two sources: the shared techniques in
[`references/verifier-catalog.md`](references/verifier-catalog.md), and the project's
`verifier-notes.md` (profile → Verifier notes) with its recipes, log and lessons. Where both cover
a technique, the project's recipe wins.

## 1. Brief the scout

Spawn one read-only `Explore` agent. Give it paths, not summaries:

> Find the best way to prove the change described in `.flow/<slug>/brief.md` (read it first; the
> plan, if any, is `.flow/<slug>/plan.md`). Read `.claude/flow/profile.md`,
> `.claude/skills/find-verifier/references/verifier-catalog.md`, the project's verifier notes
> (profile → Verifier notes: all recipes and lessons, the last 20 log lines), then the code the
> brief touches, its existing tests, and the matching feature file (profile → Verify → Feature
> map). Also read
> `.claude/skills/principle-test-behavior-not-implementation/SKILL.md`.
>
> Return 1 to 3 proposals, best first. For each:
> - **Technique**: a catalog entry, or "new: <name>" if none fits.
> - **Signal**: the exact thing observed (a value, a diff, a count, a timing, a console line).
> - **Before / after**: the commands that capture it on the base commit and on the change, using
>   this repo's tools (profile → Verify and → Gates, git). Real paths.
> - **Pass rule**: what must change and what must stay the same.
> - **Can it fail?** The deliberate break (revert the fix, flip a condition, change a value) that
>   must turn the check red.
> - **Cost** (minutes, data it needs) and **blind spots** (what it cannot see).
>
> Prefer the cheapest proposal that watches the user-visible outcome. Do not write files.

## 2. Pick and prove the verifier

Choose a proposal (the first, unless its cost or blind spots are wrong for this task). Then prove
the verifier itself: run it against the deliberate break from **Can it fail?** and confirm it goes
red. A verifier that stays green when the behaviour is broken proves nothing, so pick another.

## 3. Hand it over

Write the chosen proposal into `plan.md` under `## Proof`, including the break that turned it red.
`before-after` runs it.

## 4. Feed the notes

Append one line to `## Log` in the project's verifier notes:

```
<date> | <task slug> | <task kind> | <technique> | caught something: yes/no | note
```

If the technique was new, or a recipe was wrong or missing a step, edit `## Recipes` in the
project's notes in the same PR; if the verifier first stayed green on the break, add a `## Lessons`
line. A lesson that holds for any project goes to the shared catalog instead, through a PR on the
shared skills repo (see its README). Both only grow from runs that happened.

## Private data

Replays over private data report counts and diff statistics only, never the data itself. Anything
committed or posted uses synthetic data.
