---
name: scope-task
description: Turn a task request (bug, feature, refactor or chore) into a brief with observable expected behaviour, before any plan exists. Restates the goal, investigates the repo and the running app, settles what can be looked up or decided by convention, and asks the user only about behaviour. Use at the start of every task, for "scope this", "what exactly should this do", or whenever a request is ambiguous. Stage 1 of `deliver`.
---

# Scope a task

The output is `.flow/<slug>/brief.md`: what the user will be able to observe when the task is done.
A plan is only as good as this brief, and every later stage checks against it.

## The run folder

`<slug>` is a short kebab-case name for the task (`fix-list-hydration`). Create the folder
when it doesn't exist; `deliver` reuses it across stages and rounds.

```
.flow/<slug>/            gitignored; may hold private data, never quote it on GitHub
  state.json             owned by deliver: stage, round, base SHA, branch, PR, mode
  brief.md               this skill
  questions.md           open questions while waiting on the user (headless runs)
  plan.md                the plan, with critique rounds appended
  check.mjs              the proof script (before-after)
  evidence/              observed-today, before, after, unit-before, smoke output, screenshots
  reviews/               thermonuclear.md, solid.md, verdict-<round>.md
```

## 1. Say it back

In two or three sentences, in your own words: the goal, the problem behind it, and the smallest
change you expect will meet it. Write it to the brief as `## Goal`. If you cannot say it back
without guessing, that guess is your first question.

## 2. Look before you ask

- `CLAUDE.md`, `.claude/flow/profile.md` (including the docs under Repo → Read first), and the
  feature files (profile → Verify → Feature files) for the features the task touches.
- The code: grep the names the request uses, read the components, hooks, routes and server modules
  on the path. `git log -p` on the area when "it used to work".
- **The running app**, when the task is about behaviour: start a fixture instance (profile →
  Verify), do what the request describes, and write what happens to
  `evidence/observed-today.txt` with a screenshot. A bug report becomes a reproduction here.
- Read `.claude/skills/principle-model-the-domain/SKILL.md` when the task adds state or branching.

## 3. Sort every unknown

| Kind | Examples | What to do |
|---|---|---|
| **Observable** | "does the page show past days?", "which component renders this?" | Find out. Never ask. |
| **Settled by convention** | file layout, naming, which helper, test style, query keys, colour tokens | Decide from CLAUDE.md, the profile and the existing code. Record under `## Assumptions`. |
| **Behaviour choice** | what users see or can do, copy and UX the request leaves open, removing or changing existing behaviour, the shape of stored data, anything hard to undo, splitting the task | Ask. |

## 4. Ask with evidence

Only behaviour choices, all at once, at most four per round (`AskUserQuestion`). Each question:

- opens with what the app does **today**, from step 2, and where the evidence is
  (`evidence/observed-today.txt`, a screenshot path)
- offers outcomes, not implementations: what the user will see or be able to do afterwards
- puts the recommended outcome first, marked `(Recommended)`, and includes "keep it as it is today"
  when that is a real option

Headless (no question tool): write the questions in the same shape to `questions.md` and stop.
`deliver` posts them and resumes when they are answered. Answers go to `## Decisions` as
`question → answer → what changes for the user`.

## 5. Judge how it can be proven

Write one line under `## Proof idea`: how a run will show the task is done (a check that fails
today and passes after, or for a refactor, output that must stay identical). If nothing concrete
comes to mind, set `Verifiability: hard`; `deliver` then runs `find-verifier` before planning.

## brief.md

```markdown
# <task title>
Type: bug | feature | refactor | chore
Verifiability: clear | hard

## Goal
## Today (observed)        what happens now, with evidence paths
## Expected after          one observable statement per line: "On /x, doing y shows z"
## Out of scope
## Decisions               question → answer → what changes for the user
## Assumptions             defaults taken from convention, one line each
## Touches                 features and files likely involved
## Proof idea
```

For a refactor, `## Expected after` says what must stay the same.
