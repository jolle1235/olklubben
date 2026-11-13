# Reviewer briefs

Paste the role's brief into the agent prompt, with `<slug>`, `<pr>`, `<round>` and `<head sha>`
filled in. Every reviewer reads `CLAUDE.md`, `.claude/flow/profile.md` and `.flow/<slug>/brief.md`
first, and the diff at `.flow/<slug>/reviews/pr.diff`.

## Shared rules (include in every brief)

> You did not write this change. Do not edit the branch. You may write scratch files under
> `.flow/<slug>/reviews/<role>/` and start your own verification instance with profile → Verify →
> Up (`--id verdict-<role>-<round> --ref <head sha>`, fixtures only; follow
> `.claude/skills/verify/SKILL.md`), and you must stop it when done (profile → Verify → Down).
>
> A finding needs evidence: a command and its output that show the failure, or, when it cannot be
> run, the exact code path from input to failure with `file:line` at each step. Opinions without
> evidence are dropped. Say whether the PR introduced the problem or it already existed.
>
> Reply with one block per finding, then `NONE` if there are none:
> ```
> ID: <role>-<n>
> SEVERITY: blocker | major | minor
> INTRODUCED: yes | no
> WHERE: path:line
> CLAIM: one sentence
> EVIDENCE: command + output, or the code path
> ```
> From round 2: first list each earlier finding as `FIXED` or `STILL OPEN` with evidence, then
> review only `git diff <previous head>..HEAD`.

## bugs

> Find correctness defects this change introduces. Read every changed file in full and the callers
> of every changed export. Probe the edges in profile → Bug-prone edges, and the general ones:
> empty lists and missing optional fields; dates, "today" and time zones; optimistic updates
> without rollback or with the wrong cache key; state that should reset per item; values that
> differ between server and client render (hydration); debounced or concurrent saves that lose or
> duplicate a write. Prove each with a run: a scratch test file, or a script with the driver
> (profile → Verify → Driver) against your instance.

## security

> Find ways the change lets input do something it should not. Trace every value from a request
> (query string, JSON body, form data, uploaded file, URL to fetch) to where it is used. Check the
> sinks and guards in profile → Security sinks, and the general ones:
> - Database: injection through raw queries, operators or filters built from input; ids parsed
>   without validation.
> - Access: every new route or server action checks the session/permission the profile requires.
> - Server-side requests to user-supplied URLs go through the project's guarded fetch.
> - Browser: raw HTML injection, user-controlled `href`/`src` (`javascript:` URLs).
> - Uploads: size and content type checks.
> - Secrets: env values reaching client code or logs; anything committed.
> Report problems the PR did not introduce only as follow-ups (`INTRODUCED: no`) unless the change
> makes them worse. Prove what you can against your instance; otherwise give the input → sink path.

## intent

> Judge whether the change does what the brief asks, from the user's side. Read
> `.flow/<slug>/brief.md` and form your own expectations before reading the PR body or
> `.flow/<slug>/plan.md`. Then, on your own instance of the PR head:
> 1. Check every line of `## Expected after` by driving the app (use the feature files in profile →
>    Verify).
> 2. Re-run the PR's own proof: `node .flow/<slug>/check.mjs verdict-intent-<round>` must exit 0
>    (for a refactor, its output must equal `.flow/<slug>/evidence/before.txt`).
> 3. Run profile → Verify → Smoke on your instance; compare with
>    `.flow/<slug>/evidence/smoke-before.txt` for new failures or problems.
> 4. Check scope: nothing changed that the brief did not ask for; user-visible changes are reflected
>    in the feature map; `## Decisions` are implemented as answered; profile → After each task was
>    done.
> A mismatch between brief and behaviour is `major` or `blocker`; say which line of the brief it
> breaks.
