# Verifier notes: Ølklubben

The project's memory for proving changes, across sessions. Read by `find-verifier`, `scope-task`,
`before-after`, `verify` and `update-verify` (profile → Verifier notes). Only append from runs that
happened; never delete lines, strike them through with a pointer instead.

## Recipes

This repo's recipes, numbered like the shared catalog
(`.claude/skills/find-verifier/references/verifier-catalog.md`); where both cover a technique, the
recipe here wins. Tools: the verify harness (`scripts/verify/`, one isolated instance per id, profile
→ Verify), Playwright E2E (`e2e/`, port 3100, `olklubben_test`), Vitest unit (`src/**/*.test.ts`),
Vitest integration against Postgres (`tests/integration/**/*.itest.ts`, `olklubben_itest`), git.

### 1. UI drive on the real app, before and after

- **Use when:** anything a user sees or does in the app.
- **Recipe:** `npm run verify:up -- --id <slug>-before --ref <base sha>` and
  `npm run verify:up -- --id <slug>-after` (both at once is fine), doctor both, then the same
  `.flow/<slug>/check.mts` against each (profile → Check script). Follow the feature file for the
  path; read the result back with `app.sql`. Down both afterwards.
- **Proven:** 2026-11-14, `.flow/setup-verify/check.mts` (Kaptajnen rates Mikkeller 4 on mobile,
  `beer_ratings.value = 8`, survives reload).

### 5. Unit test, red first

- **Recipe:** `npx vitest run <file>` on the unchanged code, save the failure to
  `.flow/<slug>/evidence/unit-before.txt`, implement, run again.

### 8. Data-state diff / server-side rules

- **Use when:** a Server Action's authorization, club isolation, or what it writes.
- **Recipe:** an integration test in `tests/integration/` that calls the real action;
  `expectNotFound` / `expectRedirect` from `tests/integration/helpers.ts`. Runs one file at a time
  against `olklubben_itest`.

### 11. Fake clock and time zone

- **Recipe:** the E2E config already uses `timezoneId: "Europe/Copenhagen"`; set the time with
  `page.clock.setFixedTime(...)`. `e2e/overview-calendar.spec.ts` has the DST case (E20).

### 12. Performance numbers and the service worker (production build)

- **Use when:** load time, database round trips, `staleTimes`, or anything in `public/sw.js`. The
  service worker only registers in production builds, so `next dev` (instances, smoke, E2E) never
  runs it, and dev timings say nothing.
- **Recipe:** a check script that, for an instance id:
  - runs `next build` in the instance copy with `NEXT_DIST_DIR=.next-prod`, so the dev server's
    `.next` is left alone, and the instance env from `processEnv(state.pid)` with
    `NODE_ENV=production`;
  - starts `next start` on a free port;
  - puts a TCP proxy in front of Postgres that delays every chunk from the database by D ms, and an
    HTTP proxy in front of the app that can hold HTML and RSC responses for 3 s. `BETTER_AUTH_URL`
    points at the HTTP proxy;
  - logs in through `/api/auth/sign-in/email` with `origin`.

  Sequential SQL round trips ≈ (median at D = 100 − median at D = 0) / 100: warm the pool at each
  D and read the whole body. Count document loads with `page.on("load")`, not `framenavigated`
  (Next's `replaceState` fires that too). To test a deploy, rebuild with a visible change (e.g.
  `data-build="b"` on the bottom nav) and clear Chromium's HTTP cache through CDP
  `Network.clearBrowserCache`, or the old chunks come from there instead of the worker.

- **Proven:** 2026-11-19, `.flow/fast-first-load/check.mts` (local, gitignored; copy it):
  - BEFORE: 13.1 round trips and a 6,490 ms reopen against a 3 s server.
  - AFTER: about 7 round trips and 129 ms.
  - Three deliberate breaks each turned the expected checks red.
  - One build takes about 45 s, so a full run is about 4 min.

## Log

One line per task that chose a verifier (`find-verifier`) or ran `before-after`.

```
date       | task slug | kind | technique | caught something | note
2026-11-14 | setup-verify | chore | 1. UI drive | yes | the harness's own screenshot caused a hydration-mismatch PROBLEM; fixed in the driver (caret: "initial")
2026-11-14 | google-only-auth | feature | 1. UI drive (--google, captured redirect) + 8. data-state (scratch-DB migration itest) | yes | BEFORE showed "Log ind med Google igen" sending prompt=login to Google (F-098), found by plan-critique
2026-11-18 | compact-ui-density | feature (visuel) | 1. UI drive: computed styles og målte højder ved 375 + 1280 | yes | BEFORE 11 FAIL; brud på card-tokenet gav 2 FAIL; niveau-review fandt desktop-padding på hero-knapperne under smagningen, som checket ikke dækker (ikke seedet)
2026-11-18 | settings-hub | feature | 1. UI drive (375 + 1280) + unit (nav-history) | yes | BEFORE 8 FAIL; to brud (Indstillinger ude af hovedsiderne, /feedback-grenen) gav hver én rød linje
2026-11-19 | d183-followups | chore | 1. UI drive + E2E med/uden config | yes | F-099 BEFORE: Playwright-serveren starter ikke; places.spec kunne ikke genskabes under kontrollerede forhold (2 × 236/236)
2026-11-19 | fast-first-load | feature (ydelse) | 12. produktionsbuild bag forsinket DB + langsom server | yes | BEFORE 3 FAIL (13,1 rundture, 6.490 ms genåbning, RSC ved faneskift); plan-critique fandt, at layout og side renderer parallelt, og at et 10 s-vindue ville gøre to checks røde
```

## Lessons

What failed, was misunderstood or surprised a run, so the next session doesn't repeat it.

```
date       | task | what went wrong or was misunderstood → what to do instead
2026-11-14 | setup-verify | a worktree with a symlinked node_modules fails in Turbopack ("Could not find the Next.js package") → the harness hard-links node_modules (`cp -al`); don't go back to the symlink recipe
2026-11-14 | setup-verify | `next dev` writes `<distDir>/…/types` globs into tsconfig.json → never run an instance in the repo's own tree; the harness runs a copy outside the repo
2026-11-14 | setup-verify | killing the `next dev` parent (timeout, kill <pid>) left `next-server` on the port → only stop instances with `verify:down` (it kills the process group)
2026-11-14 | setup-verify | a full-page screenshot taken before hydration made React report a hydration mismatch (Playwright hides the caret with an inline style) → `app.shot()` uses `caret: "initial"`; don't call `page.screenshot` directly without it
2026-11-14 | setup-verify | `pkill -f "<pattern>"` in a shell command matched the shell itself and killed it → never kill by pattern; use the recorded pid (`verify:down`)
2026-11-14 | setup-verify | HTML escapes "&" (`Drengene &amp; Bajere`), so a raw-HTML `includes()` on a club name failed → assert on text without special characters, or through the driver's locators
2026-11-14 | setup-verify | assumed a logged-out `/join/<code>` redirects to `/login`; it shows its own teaser page ("Du er inviteret til en ølklub 🍺") → check the page before writing the journey (join.md)
2026-11-14 | setup-verify | `getByLabel("Kælenavn (valgfrit)")` matched nothing ("(valgfrit)" is a separate part of the label) → `getByRole("textbox", { name: /^Kælenavn/ })` (profile.md)
2026-11-14 | setup-verify | clicking 👍 on the calendar bug as Anders removed his vote: every seed user has already voted → use a new user to add a vote (feedback.md)
2026-11-14 | google-only-auth | `prisma migrate deploy` from the repo root reads `.env.local`, whose `DIRECT_URL` wins over a `DATABASE_URL` you pass → prove a migration with a scratch-database itest (`remove-auth0-migration.itest.ts`, `round3-migration.itest.ts`), never the CLI against an instance from the root
2026-11-14 | google-only-auth | raw `INSERT INTO accounts` failed: `id` has no database default (Prisma makes the uuid in the client) → give raw inserts `gen_random_uuid()`
2026-11-14 | google-only-auth | a `console.warn` spy set up in `vi.hoisted` had an empty `mock.calls` in the test: the history is cleared before each test, and `@/env` warns at import → collect the calls into your own array in the spy's implementation
2026-11-14 | google-only-auth | smoke run after the check script failed on Mads (the check had removed his password) → run smoke before any check that changes seed users
2026-11-14 | google-only-auth | smoke's beers journey failed 4/4 on base and change alike: the click on a catalogue card landed during hydration and was lost → the driver's `app.goto()` now waits until the page's h1 has React props (not just <body>: a streamed loading.tsx boundary hydrates after the shell); a FAIL also prints Playwright's `Locator:` line
2026-11-16 | event-beer-rating-ux | plan's E2E grep looked for click-then-toHaveURL only; `e2e/events.spec.ts` also asserted the event card's exact `href` → when a link's URL changes, grep `e2e/` for the href builder's output (`toHaveAttribute("href"`) too
2026-11-16 | event-beer-rating-ux | `TastedAt` already links to the event, so a back-link check by name matched two links → match the back link with `exact: true` and its position above the h1
2026-11-16 | ui-add-back-google | a click right after a server-action redirect raced the `?toast=` cleanup (router.replace) and stayed on the page under full-suite load → wait for the toast to leave the URL (`toHaveURL(/…$/)`) before clicking
2026-11-16 | ui-add-back-google | `page.goto` is a full load: anything kept in module state or reset per document (the nav history) starts over → drive in-app history by clicking, and test the full-load case on purpose
2026-11-16 | ui-add-back-google | Next's agent upgrade nudge (`experimental.agentUpgrade`) stops every other `next dev`/`next build` start; the E2E webServer deletes `.next-e2e/dev`, where Next keeps its retry receipt, so Playwright's own start never gets past it → start `next dev --port 3100` by hand with the E2E env (twice), Playwright reuses it
2026-11-16 | ui-add-back-google | `next build` with a custom `NEXT_DIST_DIR` rewrote tsconfig.json (adds its types globs, reflows arrays) → build with the default `.next`, or `git checkout tsconfig.json` afterwards; `next build` also needs `.env.test` sourced in a worktree without `.env`
2026-11-16 | ui-add-back-google | the songbook title grep has no title list in a worktree; the local dev database only holds the 7 synthetic seed songs → say so in the status row instead of claiming "0 fund"
2026-11-16 | ui-add-back-google | the plan's history rule ("the previous page is a step back") passed every planned flow but broke the tasting flow and revisits from another tab; merge-verdict reviewers found both → when a rule generalises over navigation, check it on the app's main flows (event → Tilføj øl → beer → Smagt til → event), not only the case it was written for
2026-11-16 | ui-add-back-google | smoke "beers" failed on a fresh instance of master and the branch alike: a click on a catalogue card right after load sometimes never navigates (1/4 in a loop) → a pre-existing race; compare with a BEFORE smoke run at the same time before blaming the change, and an earlier green smoke is not proof it is stable
2026-11-16 | ui-add-back-google | a check that creates data (6f adds a beer) makes a later smoke on the same instance fail ("9 øl") → run smoke on a fresh instance, or before the check
2026-11-16 | ui-add-back-google | round 2 fixed the reported flow by listing "detour" pages (forms, beers) and the next review found the same bounce via places and polls → name the rule by what does NOT belong (the main pages in the nav), not by the cases seen so far
2026-11-18 | compact-ui-density | Nexts "1 Insight"-pille (agentUpgrade) ligger over bundnavigationen ved 375 px og fanger klik i E2E, selv med devIndicators slået fra → start E2E-serveren med agentUpgrade slået fra (F-099), og tjek `<nextjs-portal> intercepts pointer events` i call log, før en timeout skyldes ændringen
2026-11-18 | compact-ui-density | `sed 's/ +"/"/'` "til at rydde op" efter en klasse-erstatning ramte første mellemrum+citationstegn på HVER linje i filen (imports, kommentarer) → erstat klasser med et præcist regex i Python pr. fil, og kør `prettier --check` med det samme
2026-11-18 | compact-ui-density | Prettiers Tailwind-plugin sorterer klasser i strenge givet til `cn(...)`, også i tests: `cn("p-card p-4")` blev til `cn("p-4 p-card")` → giv klasserne som separate argumenter, når rækkefølgen er det, der testes
2026-11-18 | compact-ui-density | `pkill -f "next dev --port 3100"` dræbte også min egen shell (exit 144), igen → stop E2E-serveren via dens baggrundsopgave eller pid fra `lsof -ti :3100`
2026-11-18 | compact-ui-density | et layout-check, der måler fast seed-tilstand, dækker ikke varianter som "i gang nu"; en className-override (`px-4`) mod en responsiv størrelse (`md:px-7`) slap igennem → når en primitiv får en responsiv størrelse, grep kaldere med en override af samme egenskab og tilføj `md:`-versionen
2026-11-18 | compact-ui-density | at skjule et in-page link på mobil (`max-md:hidden`) brød en E2E, der klikkede det på mobil (`round2-dod` "Belgisk aften"), som ingen grep efter "Tilbage"/"Alle steder" fandt → når et link skjules på en breakpoint, grep e2e/ efter dets tekst (også event-/øl-navne brugt som linktekst) og kør hele suiten
2026-11-18 | settings-hub | en ny side i `WARM_PATHS` (fixtures.ts) får `verify:up --ref <base>` til at fejle med 404 under opvarmningen, fordi harnessen kører fra arbejdstræet → fjern linjen midlertidigt, mens BEFORE startes, og sæt den tilbage (eller lad harnessen springe 404 over for --ref)
2026-11-19 | settings-hub | en stablet PR (#15, base = #14's gren) blev merget efter #14 var på master; GitHub retargetede ikke basen, så ændringen landede kun på flow-grenen og Vercel lavede et preview, ikke produktion (rettet med #16) → når basen er merget: `gh pr edit <n> --base master` før merge, og tjek altid `baseRefName` i verdict og ved "merge"
2026-11-19 | d183-followups | "ustabile" E2E-fejl (places.spec) opstod kun, når en manuelt startet E2E-server og verify-instanser kørte samtidig → lad Playwright starte serveren (virker efter F-099), stop verify-instanser før fuld E2E, og genskab en fejl under de forhold, før den "rettes"
2026-11-19 | fast-first-load | antog at Better Auths cookieCache ville spare en DB-rundtur ved åbning; Server Components kan ikke sætte cookies, så den signerede cookie fornyes næsten aldrig → mål før du lover en serveroptimering, og tjek om mekanismen kræver en Set-Cookie fra RSC
2026-11-19 | fast-first-load | antog at layoutet ligger på den kritiske vej; layout og side renderer parallelt i App Router → skær rundture på sidens egen kæde
2026-11-19 | fast-first-load | Better Auth (uden `advanced.database.joins`) og Prisma (uden `relationJoins`) bruger ét SQL-kald pr. relationsniveau, så et "kald" er flere rundture → mål i SQL-rundture med en forsinkende TCP-proxy (recipe 12), ikke ved at tælle funktionskald
2026-11-19 | fast-first-load | instansen forsvandt mellem to kørsler (en anden session kørte `verify:down -- --all`) → tjek `verify:list` før en lang kørsel, og start igen med samme id
2026-11-19 | fast-first-load | check-scriptet ændrer seed-data (stemmer, fjerner Anders), så en anden kørsel på samme instans fejlede → down + up før hver kørsel; brud-kørsler på egne instanser parallelt (patch instansens kopi, før checket bygger)
2026-11-19 | fast-first-load | `framenavigated` talte Next' replaceState som en navigation, og check 2 blev rød uden reload → tæl `page.on("load")`
2026-11-19 | fast-first-load | `staleTimes` 30 s gjorde feedback-filtertesten rød: den skrev direkte i DB og klikkede tilbage til en set side (F-100) → E2E, der skriver bag om appen, skal genindlæse før de navigerer tilbage
2026-11-19 | fast-first-load | `fallow audit` kaldte `public/sw.js` en ubrugt fil (browseren loader den) → filen står som `entry` i `.fallowrc.json` (commit-skillens regel for filer, et framework loader), ikke en inline-suppression
2026-11-19 | fast-first-load | beviset testede kun en langsom server; merge-verdict fandt en reload-løkke ved 5xx/ingen forbindelse (F-101) → test en service worker også med en server, der fejler, og en, der ikke kan nås (check 10)
2026-11-19 | fast-first-load | en cache, som kun en dokument-load fylder, missede login og klubskift i appen (klient-navigation) → test første genåbning efter login gennem formularen, ikke kun efter `page.goto`
2026-11-19 | fast-first-load | tømning på stier (`/onboarding`) ramte Link-prefetches fra Indstillinger → filtrér `next-router-prefetch`, og kør et check, der besøger sider med prefetchede links
2026-11-19 | fast-first-load | en måling gennem en lokal forsinkende HTTP-proxy gav 9,4 s i stedet for 6,4 s: den forrige fanes forsinkede requests fyldte Chromes 6 HTTP/1.1-forbindelser → luk den forrige fane, eller vent, til dens requests er færdige, før næste tidtagning
2026-11-23 | no-topbar-title | skrev D-185 i kodekommentarer uden at slå op; nummeret var allerede taget (service worker), fundet af thermonuclear → find næste frie D-/F-nummer i SPEC §19.3/§19.4, før det skrives nogen steder
2026-11-23 | no-topbar-title | et slør i toppen af den installerede iPhone-app kunne ikke ses i Chromium; årsagen (iOS 26-slør over `black-translucent`) kom fra udviklerrapporter → spørg hvor (installeret/Safari/Android) og hvornår, før en statusbar-fejl jagtes i Playwright; beviset kan kun dække meta-tagget
2026-11-23 | main-page-topbar | `git checkout <fil>` for at fortryde et bevidst brud ville have slettet de ikke-committede ændringer (auto mode stoppede det) → kopiér filen til scratchpad før bruddet og kopiér tilbage
2026-11-23 | main-page-topbar | et 59-tegns klubnavn med æøå ramte `clubs_name_length_check`: verify-databasen tæller bytes som tegn → hold testnavne med æøå under 60 bytes
2026-11-23 | no-topbar-title | PR #19 skiftede statusbaren efter udviklerrapporter; på iPhone hjalp kun en fast top bar (F-103) → kald ikke en platformsrettelse løst, før Jesper har tjekket den på telefonen
```
