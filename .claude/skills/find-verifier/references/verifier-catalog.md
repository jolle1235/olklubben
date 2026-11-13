# Verifier catalog (shared)

Techniques for proving a change, independent of any one project. Each entry: **Use when**,
**Signal**, **Recipe**, **Cost**, **Blind spots**. The project's
`.claude/flow/verifier-notes.md` (profile → Verifier notes) holds the concrete recipes with its
tools and wins where both cover a technique. Add a lesson here only when it holds for any
project, and only from a run that happened.

Tools every recipe assumes: the project's verify instances (profile → Verify: up with `--ref`,
doctor, smoke, down, the driver), its test runner, and git.

---

## 1. UI drive with assertions

- **Use when:** the task changes what a user sees or can do on a page.
- **Signal:** visible text, roles, counts, and the state read back through the API, plus the
  driver's problems (console errors, page errors, failing API calls).
- **Recipe:** a `.flow/<slug>/check.mjs` from profile → Check script, following the matching feature
  file. BEFORE on `--ref <base>`, AFTER on the working tree.
- **Cost:** about 1 minute per instance.
- **Blind spots:** paths the script does not take; layout (see 7).
- **Hydration and first-load checks** (React/Next):
  - Load each page in a **fresh browser**: Next's dev tooling reports a given mismatch only once per
    session.
  - Wait for hydration on a locator before reading the console or typing; a fixed sleep misses
    warnings at random.
  - Check the element is in the server HTML and print `ssr=yes|no`: a page served from a static
    shell renders client-only and proves nothing.
  - The console warning is unreliable on its own; also assert a symptom (a stale attribute, focus
    that doesn't move).

## 2. Golden replay of recorded inputs

- **Use when:** refactoring or rewriting a function that turns input into output (parsers,
  formatters, normalizers, mappers).
- **Signal:** the full list of `input → output` pairs; any difference is a finding.
- **Recipe:**
  - **Inputs.** Mostly *generated*: the cross product of the dimensions the function cares about,
    plus odd single cases. Private data is good for realistic shapes, rarely as the main source.
    Build inputs independently of the code under test (copy tables from the base commit once), or a
    dropped case silently drops out of the inputs too.
  - **Run the base.** `git archive <base> <src dir> | tar -x -C <scratch>/base` gives the base
    source; load TypeScript with `jiti` (or `tsx`) from the repo's `node_modules`. Print one JSON
    line per input with sorted keys and volatile fields removed.
  - **Compare.** Run on the base copy and the working tree, run the base twice (determinism), then
    `diff`. Results from private data: counts only.
  - Commit only a small synthetic table as a unit test; the replay stays local.
- **Cost:** 15–20 minutes to write the runner the first time, seconds per run.
- **Blind spots:** inputs nobody generated; wiring (who passes which arguments); see 6.

## 3. Differential run (old vs new side by side)

- **Use when:** replacing an implementation and both can live in one process for a moment.
- **Signal:** `old(x) === new(x)` for every generated or recorded `x`.
- **Recipe:** in a scratch test file, import the new function and the old one
  (`git show <base>:<path>`); loop over the inputs from 2. Delete the old copy before committing.
- **Cost:** low.
- **Blind spots:** side effects; shared state.

## 4. Round-trip and property checks

- **Use when:** paired conversions (parse/format, to-form/from-form, serialize/deserialize).
- **Signal:** `back(forth(x))` equals `x` (normalised), for every fixture case.
- **Recipe:** a unit test over the fixtures, plus a local run over private data.
- **Cost:** low.
- **Blind spots:** both directions sharing the same bug.

## 5. Unit test, red first

- **Use when:** pure logic with clear edge cases (dates, quantities, units, parsing).
- **Signal:** a test that fails on the base code for the reason in the brief.
- **Recipe:** write the test, run it on the unchanged code and save the failure to
  `evidence/unit-before.txt`, implement, run again. Commit the test with the fix.
- **Cost:** lowest.
- **Blind spots:** wiring, rendering, data flow.

## 6. Characterization snapshot

- **Use when:** a behaviour-preserving refactor of a page or API route.
- **Signal:** the normalised output (an ARIA snapshot of `main`, visible text, or API JSON with ids
  and timestamps removed) is identical before and after.
- **Recipe:** `check.mjs` prints the normalised output; run it on both instances and `diff`.
- **Cost:** about 1 minute.
- **Blind spots:** styling; anything you normalised away.

## 7. Visual diff

- **Use when:** layout, spacing, colour, responsive behaviour.
- **Signal:** the pixel difference between screenshots at the same viewport, above a threshold, in
  the region that should change and nowhere else.
- **Recipe:** screenshots of the same route on BEFORE and AFTER instances, compared with pixelmatch
  (run from an npm script so static analysis sees the dependency). Freeze time-dependent content
  first (see 11).
- **Cost:** low once a diff helper exists.
- **Blind spots:** other viewports; hover and focus states.
- **Candidate refinement — layout geometry diff:** measure bounding boxes, gaps and a few computed
  styles of elements found by role and text, after fonts and images load; print one rounded line
  per measurement; pass when only the intended values change. Promote after a real run.

## 8. Data-state diff

- **Use when:** anything that writes the database: saves, merges, deletes, write-backs.
- **Signal:** the records before and after one user action. Exactly the intended change, nothing
  else.
- **Recipe:** connect to the instance's database, dump the touched tables/collections, drive the
  action, dump again, and diff.
- **Cost:** low.
- **Blind spots:** writes that happen later (debounced saves): wait before the second dump.

## 9. Logs and instrumentation

- **Use when:** "it saves twice", refetch loops, N+1 queries, race conditions.
- **Signal:** a count or an order of events: requests per action, server log lines, temporary
  markers.
- **Recipe:** count the events for one action on BEFORE and AFTER. Remove temporary logs before the
  commit (`thermonuclear-review` flags leftovers).
- **Cost:** low.
- **Blind spots:** events nobody logged.

## 10. Performance numbers

- **Use when:** "slow", bundle size, render cost, query time.
- **Signal:** one number with a unit, before → after (the median of N runs on the same machine), and
  the reason it moved.
- **Recipe:** warm up first; then N=10 timed runs around the action, or a trace; build output sizes
  for bundle questions. Explain what limits the number before trusting it.
- **Cost:** about 10 minutes.
- **Blind spots:** dev mode is not production; build and start for real numbers (see 13).

## 11. Fake clock and time zone

- **Use when:** anything with dates, "today", week grids, deadlines, recurring events.
- **Signal:** the same assertion under the users' time zone and `TZ=UTC`, and around midnight and
  DST changes.
- **Recipe:** the test runner's fake timers plus `TZ=... <test command>`; in the browser, a context
  with `timezoneId` and `page.clock.setFixedTime(...)`.
- **Cost:** low.
- **Blind spots:** server and client in different zones: test both sides.

## 12. Recorded external input

- **Use when:** scraping, imports, webhooks, third-party API responses.
- **Signal:** results from saved responses, never from live services.
- **Recipe:** save the response as a test fixture and assert what the code extracts from it.
- **Cost:** low.
- **Blind spots:** the service changing later.

## 13. Production build checks

- **Use when:** caching, service workers, security headers, cookies, anything that differs between
  dev and prod.
- **Signal:** behaviour of a production build and start: offline mode, cache hits, cookie flags.
- **Recipe:** a production-mode instance (if the project's harness supports one, profile → Verify), then the task's
  `check.mjs` and smoke against it. Confirm the build really ran in the instance logs.
- **Cost:** a build plus the checks.
- **Blind spots:** host-specific behaviour (the hosting platform's image optimizer, edge, env per
  environment).

## 13b. Anonymous request matrix (access control)

- **Use when:** anything about who may reach what: login, roles, a gate in front of routes.
- **Signal:** for every page and every API route × method, the status and body an anonymous (or
  wrong-role) client gets, plus bypass shapes (encoded segments, trailing slashes, case, `//`, `\`,
  framework internals such as `/_next/image` or `x-middleware-subrequest`), and the data read back
  with a valid session afterwards.
- **Recipe:** `fetch` with `redirect: "manual"` for exact statuses, `redirect: "follow"` for bypass
  shapes (pass = not 2xx, or ends on the login page, and no fixture data in any body). Prove each
  protection layer separately with deliberate breaks (allowlist a path in the outer gate: the inner
  check must still refuse).
- **Cost:** about 2 minutes per instance.
- **Blind spots:** routes added later (the list is explicit); client-side state after a session ends.

## 14. Static guarantee

- **Use when:** "make sure this can't happen again" and the bug was a shape or wiring mistake.
- **Signal:** the compiler, lint or the static gate rejects the bad version.
- **Recipe:** a type that makes the bad state impossible, a lint rule, or a static-gate rule; prove
  it by writing the bad version and watching the gate fail.
- **Cost:** varies.
- **Blind spots:** runtime data that bypasses the types (parse it at the boundary).
