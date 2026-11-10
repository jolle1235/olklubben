---
name: plan-critique
description: Independent critique of an implementation plan by a fresh, read-only agent that sees only the brief, the plan and the repository, never the conversation that produced them. Returns SOUND, REWORK or ASK-HUMAN with required changes. Use after writing a plan and before asking the user to approve it, or when asked to "critique the plan" or "get a second opinion on this plan". Stage 3 of `deliver`.
---

# Plan critique

A planner grading its own plan finds what it already believes. This skill hands the plan to an
agent that did not write it and has no stake in it.

## Inputs

`.flow/<slug>/brief.md` and `.flow/<slug>/plan.md`. With no run folder (standalone use), write the
plan under discussion to `.flow/<slug>/plan.md` first, with a brief if there is none.

## Run

Spawn one `Plan` subagent (read-only). Give it file paths, not a summary of them; the paraphrase is
exactly what would anchor it. Prompt:

> You are reviewing a plan you did not write. Read, in this order: `CLAUDE.md`,
> `.claude/flow/profile.md`, `.flow/<slug>/brief.md`, `.flow/<slug>/plan.md`, then whatever code
> the plan touches. Also read `.claude/skills/principle-subtract-before-you-add/SKILL.md` and
> `.claude/skills/principle-prove-it-works/SKILL.md`. Check:
>
> 1. **Coverage.** Every line under `## Expected after` in the brief maps to a plan step and to a
>    proof. Nothing in the plan goes beyond the brief.
> 2. **Proof.** The plan names a check that fails on today's code (or, for a refactor, records
>    output that must stay identical), runs on fixture data, and could actually fail. "Tests pass"
>    or "looks right" is not a proof. If the proof is weak, say which `find-verifier` technique
>    would fit.
> 3. **Size.** The smallest change that meets the brief. Flag speculative guards, options and
>    layers, and code that a canonical helper already covers (profile → Canonical homes).
> 4. **Conventions and gates.** The rules in CLAUDE.md and profile → Stack, and what profile →
>    Gates and → Commit will reject.
> 5. **Hidden decisions.** Behaviour the plan changes that is not in the brief's `## Decisions`:
>    stored data shapes, removed behaviour, new user-visible copy.
> 6. **Risks.** What could break for users or data, and whether the plan checks it.
>
> Verify claims about files and functions by reading them. Reply exactly:
> `VERDICT: SOUND | REWORK | ASK-HUMAN`, then `MUST:` (numbered, each with the concrete change),
> `CONSIDER:`, `MISSED RISKS:`. No other prose.

## After the verdict

Append it to `plan.md` as `## Critique (round <n>)` with the verdict verbatim and what you changed.

- **SOUND** → done.
- **REWORK** → apply every MUST item, then run one more round on the revised plan. Two rounds at
  most; after the second, keep any remaining MUST items in the plan as open points for the user.
- **ASK-HUMAN** → the hidden decisions go to the user in `scope-task`'s question format, and the
  answers go to the brief's `## Decisions` before the plan is revised.

Report the verdict line and the MUST list. When `deliver` called this, that is the whole output.
