---
name: deliver
description: Take one task - a bug fix, refactor, feature or chore, small or big - from request to a merge-ready PR in this repo, through a fixed loop of stages - scope (ask only about behaviour), plan, independent critique, the user's approval, implementation with before/after proof on the real app, clean-code passes, the commit gate, PR, and a three-reviewer merge verdict that routes problems back to the right stage. Stops at READY and waits for the user to say merge. Use when the user hands over a task to do end to end ("deliver ...", "fix ...", "build ...", "refactor ...") or says "deliver resume <slug>".
argument-hint: '"<task>" | resume <slug> | --headless --issue <n> ["<task>"]'
---

# Deliver

You run the loop; the stage skills do the work. Every stage reads `.flow/<slug>/state.json` first
and writes it last, so any stage can be re-run and a stopped run can be resumed.

## The project profile

Every stage reads `.claude/flow/profile.md` for the project's commands and rules: base branch,
verify instance commands, gates, commit gate, merge, conventions. "profile → X" below means
section `## X` there. **No profile?** Stop, copy [`references/profile-template.md`](references/profile-template.md)
to `.claude/flow/profile.md`, fill in what the repo shows, ask the user only what it doesn't, and
let them review it before the first run. Without a verify skill (`profile → Verify`), offer
`create-verification-skill` first.

## Stages

| # | Stage | Do | Done when |
|---|---|---|---|
| 0 | setup | Below. | On branch `flow/<slug>`, `state.json` written. |
| 1 | scope | `scope-task` | `brief.md` written; behaviour questions answered. |
| 2 | plan | Write `plan.md` (below). `Verifiability: hard` → `find-verifier` first. | Every `Expected after` line has a step and a proof. |
| 3 | critique | `plan-critique` | SOUND, or 2 rounds done with open points listed. |
| 4 | approval | Show the plan; the user approves (below). | Approved. |
| 5 | build | `before-after` | BEFORE red (or pinned), AFTER green (or identical). |
| 6 | clean | Below. | Gates green, reviews applied, AFTER still green. |
| 7 | commit | `commit` | Committed through the project's gate. |
| 8 | publish | Below. | PR open and up to date. |
| 9 | verdict | `merge-verdict` | READY, FIX, HUMAN or REBASE. |

`<base>` below is profile → Repo → Base branch.

## 0. Setup

- New run: pick `<slug>` (kebab-case, a few words). Require a clean tree; if it isn't clean, stop and
  say what is uncommitted. `git fetch origin`, `git switch -c flow/<slug> origin/<base>`.
- Resume (`deliver resume <slug>`): read `.flow/<slug>/state.json`. If it is gone (another machine),
  find the PR for branch `flow/<slug>` and rebuild the state from the `<!-- flow-state ... -->`
  block in its body and the `<!-- flow-verdict ... -->` comments. Continue at the recorded stage.
- Check the tools once: the commands in profile → Verify and → Gates exist, and `gh repo view`
  works (if PR commands fail with "must be a collaborator", use
  `GH_TOKEN="$(gh auth token --user <owner>)"` for `gh` from then on and note it in state).
- Make sure `.flow/` is gitignored.
- Write `state.json`:

```json
{
  "slug": "fix-list-hydration",
  "task": "the request, verbatim",
  "mode": "interactive",
  "issue": null,
  "stage": "scope",
  "round": 1,
  "base": "<origin/<base> sha at start>",
  "branch": "flow/fix-list-hydration",
  "pr": null,
  "proof": null,
  "verdicts": [],
  "waitingOn": null
}
```

## 2. Plan

`plan.md` sections: `## Approach` (why this shape, with file references), `## Steps` (ordered,
dependencies first), `## Files` (each confirmed to exist or marked new), `## Proof` (the check,
what BEFORE and AFTER must show, and the deliberate break that turns it red), `## Risks`.
The smallest change that meets the brief.

## 4. Approval

Show the brief's `Goal` and `Expected after`, the plan's `Steps` and `Proof`, and the critique
verdict. Ask with `AskUserQuestion`: approve (Recommended) / change something / stop. A change
request goes back to stage 2 (or 1 if it changes behaviour). Nothing is built before approval.

## 6. Clean

1. Gates: every command in profile → Gates, on the changed code. Fix failures (with the skill the
   profile names for the static gate).
2. `/simplify` on the changed code.
3. Spawn two read-only agents in one message: one follows
   `.claude/skills/thermonuclear-review/SKILL.md`, one follows
   `.claude/skills/solid-check/SKILL.md`, both on the branch diff including uncommitted work, both
   replying in their skill's output format. Save the replies to `reviews/thermonuclear.md` and
   `reviews/solid.md`.
4. Apply BLOCKER and SHOULD findings that are behaviour-preserving, and cheap NITs. A finding
   that would change behaviour is a question for the user, or a follow-up for the PR.
5. Re-run step 1 and the AFTER part of `before-after`. Clean is done when both are green.

## 8. Publish

First do profile → After each task, if any, and commit it through `commit`.

Push (`git push -u origin flow/<slug>`; after a rebase, `--force-with-lease`). Create the PR, or
update its body if one exists. Never open it as a draft. Base: profile → Repo → PR base, unless the
user stacked the work on another branch.

- **Title:** short and imperative, naming what changes for the user.
- **Body:** `## Why` (the problem, 1-3 sentences) · `## What changed` (1-3 bullets) · `## Scope`
  (what it covers and leaves out) · `## Proof` (the check's BEFORE and AFTER output, from fixture
  runs only) · `## Decisions` (each user answer and what it changed) · `## Follow-ups` (pre-existing
  problems found on the way) · then the state block:

```
<!-- flow-state {"slug":"...","base":"...","round":1,"stage":"verdict"} -->
```

When profile → Repo says the repo is public, nothing from private data goes into the PR.

## 9. Verdict and the loop

Run `merge-verdict` with the PR number and the round. Then:

- **READY** → stop. Tell the user: the PR link, the verdict summary, the proof in one line, and
  "say merge to merge". On "merge": profile → Merge → Command, `git switch <base> && git pull`,
  profile → Merge → After merge, add the `find-verifier` log line if one is due,
  set `stage: "merged"`.
- **FIX** → `round += 1` and go to the earliest stage any finding is routed to:
  **understanding** → 1, and then 2, 3 and 4 again (the user re-approves changed behaviour);
  **behaviour** → 5; **structure** → 6. Every round then runs 6 (with AFTER), 7, 8 and 9.
- **REBASE** → `git rebase origin/<base>`, then 6, 7, 8 (force-with-lease), 9 in the same round.
- **HUMAN**, or a FIX in round 3 → ask the user with the findings and the options; continue where
  the answer points.

Never merge on your own, never skip a stage because a round "only" touched a little, and never
pass `--no-verify`.

## Asking the user

All questions go through one place: behaviour and scope questions in `scope-task`'s format, plan
approval in stage 4, HUMAN verdicts in stage 9. Finish everything that does not depend on the
answer before asking.

**Headless** (`--headless --issue <n>`; no question tool, for example a cloud run): the issue is
the conversation. Post the brief, questions or plan as an issue comment that starts with
`<!-- flow-wait <stage> -->`, set `waitingOn` in state, push the branch if it has commits, and stop.
`deliver resume <slug>` reads the comments after that marker. An answer from the repo owner
continues the run, and "approve" approves a plan. Without an issue, headless runs stop at stage 1.

## Summary

End every run, finished or stopped, with:

```
deliver <slug>   <READY #n | merged | waiting on you: <what> | stopped: <why>>
Task       <one line>
Proof      <check>: BEFORE <red|pinned> → AFTER <green|identical>   (evidence: .flow/<slug>/evidence/)
Rounds     <n>; verdicts <round:verdict, ...>
Decisions  <each answer → effect, or "none">
Clean      thermonuclear <CLEAN|n applied>, solid <CLEAN|n applied>, gates green
Follow-ups <pre-existing problems found, or "none">
Next       <what the user does now>
```
