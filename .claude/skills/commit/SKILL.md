---
name: commit
description: Commit changes in this repo through the project's commit gate (the commands in .claude/flow/profile.md → Commit, e.g. fallow audit, lint, typecheck). Runs the gate before committing and, if it fails, fixes the findings - with the fallow skill when the gate is fallow - instead of getting around it. Never bypasses hooks. Use whenever the user says "commit", "commit this", "commit and push", or "/commit".
---

# Commit through the gate

The project's gate is profile → Commit in `.claude/flow/profile.md`: the commands that must pass,
the hook that enforces them, files never to stage, and project rules. Your job is to make the gate
pass by **fixing the code**, not by getting around it.

## Rules

- Never use `--no-verify` / `-n`, never change `core.hooksPath`, never edit or delete the hooks
  to get a commit through.
- Never regenerate a baseline file to hide new findings, and never loosen gate config
  (thresholds, ignore patterns) without the user's explicit approval.
- An inline suppression needs a reason in the same comment, and you must ask the user first.
- Commit or push only what the user asked for. Don't push unless asked.

## Steps

1. **See what's changing.** `git status`, `git diff`, `git diff --cached`. Stage only the files that
   belong to this change. Never stage `.env*` files or what profile → Commit → Never stage lists.

2. **Run the gate yourself, before `git commit`.** Every command in profile → Commit → Gate. Lint
   runs on staged files only when the base branch has pre-existing lint errors elsewhere; fix errors
   in the files you touch, not unrelated ones.

3. **If it fails, fix by category.** When the gate is fallow, load the `fallow` skill
   (`references/issue-types.md`, `references/gotchas.md`):

   | Finding | How to fix |
   |---|---|
   | unused export / type | `npx fallow dead-code --trace <file>:<export> --format json --quiet` to confirm nothing uses it, then remove the `export` (or the symbol). For a batch: `npx fallow fix --dry-run --format json --quiet`, review, then `npx fallow fix --yes`. |
   | unused file | Trace it, then delete it. If a framework loads it by convention (route, config), add it to `entry` in the fallow config and **tell the user**. |
   | unused / unlisted dependency | `npx fallow dead-code --trace-dependency <name>`, then uninstall or install it. |
   | duplication | `npx fallow dupes --trace dup:<fingerprint> --format json --quiet` to see every copy. Extract one shared helper in the nearest common place (profile → Layers) and use it from every site. |
   | new complexity | `npx fallow health --complexity --complexity-breakdown --format json --quiet` shows which branches add up. Split the function: extract helpers, early returns, lookup tables instead of `if` chains, small components for JSX blocks. If splitting would make the code worse, stop and ask the user. |
   | circular dependency | Move the shared piece into its own module that both sides import. |
   | lint, type or format error | Fix it, following CLAUDE.md and profile → Stack. |

   After fixing, re-run step 2. If you changed behaviour, also run profile → Gates → Tests.

4. **Loop at most 3 times.** If the gate still fails after three rounds of fixes, stop. Show the
   user the remaining findings and what you tried, and ask how to proceed. Do not commit.

5. **Commit.** Stage the fix-ups too and run `git commit` with a short, imperative message in the
   style of `git log --oneline`. End it with the attribution trailer your harness asks for. If the
   hook still fails, return to step 3.

6. **Report.** The commit hash and subject, plus a short list of what the gate caught and how you
   fixed it (e.g. "removed unused export `foo` from `src/x.ts`").

## Reviewing instead of committing

If the user asks for a review of the branch before committing or merging and the project uses
fallow, use the `fallow-review` skill (`npx fallow review --base <ref>`).
