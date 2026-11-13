---
name: thermonuclear-review
description: Uncompromising structural review of a diff in this repo - hunts for the restructuring that makes the change smaller, special cases bolted onto existing flows, files and components that sprawl, layers that only pass things through, loose types, and logic outside its canonical home (from the project's flow profile). Findings only; never edits. Use in the clean stage of `deliver`, or when asked for a "thermonuclear", "deep", "strict" or "structural" review of a branch or diff.
---

# Thermonuclear review

Correctness is checked elsewhere (`before-after`, `merge-verdict`), and the static gate already
counts duplication, unused code and complexity. This review is for judgment: is this the simplest
shape the change could have had, and does it leave the codebase easier to read than it found it?

Read `.claude/skills/principle-minimize-reader-load/SKILL.md`,
`.claude/skills/principle-subtract-before-you-add/SKILL.md` and `.claude/flow/profile.md` first.

## Scope

The diff from the merge base, including uncommitted work:
`git diff $(git merge-base origin/<base branch> HEAD)`. Read every changed file in full, not just
the hunks, and the callers of every changed export (`grep -rn "<name>"` over the source).

## What to look for, in priority order

1. **The move that deletes code.** Can the change be reframed so branches, flags, helpers or a
   whole layer disappear? Look for a data shape that makes the special case the normal case (a map
   instead of an `if` chain, one derived value instead of two synced states). Moving complexity to
   another file is not a simplification.
2. **Special cases in existing flows.** A new boolean prop, an `if (type === ...)` in a shared
   component, an early return for one caller, a second flag that must stay in sync with the
   first. Each one is a design problem. Name the structure that would absorb it.
3. **Sprawl.** A component past ~150 lines doing several jobs, a file growing past ~500 lines, and
   anything in profile → Size hotspots: changes there should shrink them or extract, not add.
   Split by responsibility, not by line count.
4. **Layers that only pass things through.** Wrappers with one caller, props threaded through
   components that don't use them, a context or hook that just renames another. Inline them.
5. **Types and boundaries.** `any`, `as` casts, optional fields that are never actually optional,
   API JSON used without a type, database id types leaking past the data layer. Parse at the
   boundary, trust the types inside.
6. **Canonical homes.** New code that re-derives something listed in profile → Canonical homes is a
   blocker.
7. **Framework and project rules.** Everything in profile → Stack and CLAUDE.md (for React: effects
   only for external systems, derive instead of syncing state, reset with `key`, a query library
   for server state).
8. **Leftovers.** `console.log`, commented-out code, TODOs with no follow-up, debug flags,
   temporary instrumentation from a verifier.

## Output

Write `.flow/<slug>/reviews/thermonuclear.md` (or reply directly when run alone):

```
VERDICT: CLEAN | CHANGES
1. [BLOCKER|SHOULD|NIT] path:line - what is wrong
   Smaller version: the concrete rewrite (a sketch, not prose)
   Behaviour-preserving: yes | no (why)
```

- Few, high-conviction findings beat many small ones. "Rename this" is not a finding when the
  real issue is structural.
- Approve (`CLEAN`) only when there is no unexploited simplification, no special-case growth, no
  sprawl the diff caused, no pass-through layer, and nothing re-derived from a canonical home.
  Say plainly when the change is fine.
- Behaviour-preserving findings are applied by the caller; the rest go to the user or the PR's
  follow-ups.
