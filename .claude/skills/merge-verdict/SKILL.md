---
name: merge-verdict
description: Decide whether an open PR is ready to merge. Checks CI, mergeability and the project's gate, then runs three independent reviewer agents in parallel (bugs, security, intent+evidence - the last one drives the PR head on its own isolated instance against the brief), keeps only findings that survive a re-check, and returns READY, FIX (each finding routed to the stage that must redo it) or HUMAN. Posts the verdict on the PR. Use after a PR is opened or updated, or when asked "is this PR ready?", "can we merge?", "review this PR". Stage 9 of `deliver`; never merges.
---

# Merge verdict

Green CI is not a review, and one reviewer's confidence is not evidence. Three reviewers who did
not write the code look for different failures; a finding counts only when it survives a re-check.

Commands and rules come from `.claude/flow/profile.md`; `<base>` is profile → Repo → Base branch.

## Inputs

- The PR: a number, or the PR of the current branch (`gh pr view --json number,headRefOid`).
- The run folder `.flow/<slug>/` (the brief is the yardstick for intent). Without one, write a
  short brief from the PR body first.
- The round: 1, or `state.json` → `round`. From round 2 on, also the previous verdict file.

`gh` commands may need the repo owner's account (profile → Repo → `gh` account): if one fails with
"must be a collaborator", run it with `GH_TOKEN="$(gh auth token --user <owner>)"`.

## 1. Preconditions (no agents)

1. The local branch is pushed and the PR head matches `git rev-parse HEAD`.
2. `gh pr checks <pr> --watch --fail-fast`: every check passes. A real failure → **FIX**, routed to
   the stage that owns it (lint, tests or static gate → clean; deploy build → before-after).
3. `gh pr view <pr> --json mergeable,mergeStateStatus`: `MERGEABLE`. Conflicts or behind → return
   **REBASE**: the caller rebases on `origin/<base>`, pushes with `--force-with-lease`, re-runs the
   clean stage and AFTER, and calls this skill again (same round).
4. profile → Commit → Gate passes against `origin/<base>`.

## 2. Context pack

Gather once, pass by path to every reviewer:
`gh pr diff <pr> > .flow/<slug>/reviews/pr.diff`, the brief, and in round 2+ the previous
`reviews/verdict-<n-1>.md`. When the project uses fallow, also
`npx fallow review --base origin/<base> --brief > .flow/<slug>/reviews/blast-radius.txt`.

## 3. Three reviewers, in parallel

Spawn three fresh `general-purpose` agents in one message, each with its brief from
[`references/reviewer-briefs.md`](references/reviewer-briefs.md): **bugs**, **security**,
**intent**. Each returns findings in the shared format there. Reviewers that drive the app start
their own instance (`--id verdict-<role>-<round>`, `--ref <pr head sha>`) and stop it afterwards.

From round 2 on, reviewers first confirm whether each earlier finding is fixed, then review only
`git diff <previous head>..HEAD` for new problems. New findings count only if the diff introduced
them and they are blocker or major. This keeps the loop converging.

## 4. Re-check every finding

For each blocker and major: rerun its command, or follow its code path yourself. Keep it only if
the failure shows and it breaks the brief or the user. Merge findings with one root cause. Anything
not introduced by this PR becomes a **follow-up**, not a FIX. Minor findings are reported but never
block.

## 5. Verdict

| Verdict | When |
|---|---|
| **READY** | Preconditions pass and no confirmed blocker or major finding remains. |
| **FIX** | Confirmed findings. Each gets a route: **understanding** (the PR solves a different problem than the brief, or a behaviour question surfaced) → scope-task, then plan, critique and the user's approval again; **behaviour** (wrong result, bug, missing case) → before-after; **structure** → the clean stage. |
| **HUMAN** | A finding needs a decision the brief does not make, a security trade-off, or this is round 3 and FIX would follow. |

## 6. Publish

- Write `.flow/<slug>/reviews/verdict-<round>.md`: verdict, findings (with evidence), routes,
  follow-ups, dropped findings with the reason.
- Post or update one PR comment per round, starting with `<!-- flow-verdict round=<n> -->`, so a
  rerun edits instead of duplicating. Quote only fixture-run evidence when the repo is public.
- Update `state.json` → `verdicts[]`.
- Stop the reviewers' instances: profile → Verify → Down (all) only if no other run is active,
  otherwise each `verdict-*` id.

Report: the verdict line, the confirmed findings with their routes, and the follow-ups. Never merge;
merging is the user's call.
