# Ølklubben 🍺

En lille, social webapp for private ølklubber: kommende ølsmagninger, events, klubbens øl og ratings, sangbogen og afstemninger om dato og sted. Mobilen er primær.

**[SPEC.md](SPEC.md) er kilden til sandhed** for produkt, arkitektur og beslutninger. Implementeringsstatus står i SPEC §19.2.

## Hvad kan appen (runde 1 og 2)

Appen bygges i fire runder (SPEC §16.3). Runde 1 ("Vi har en klub") er fundamentet, runde 2 ("Vi kan faktisk bruge den") giver events, kalender, ølkatalog og ratings.

**Runde 1**

- **Konto:** opret konto, log ind og log ud med email og password. "Fortsæt med Google", når Google er sat op. "Glemt password" med et engangslink på mail (1 time). Uden mail-opsætning kan en admin lave nulstillingslinket fra medlemslisten.
- **Klubber:** opret en klub (du bliver Admin), eller join med en kode eller et link (`/join/K7XMQ2PA`). Et invitationslink overlever login og signup, så man lander direkte på join-bekræftelsen.
- **Flere klubber:** `/` sender dig til din eneste klub, din senest åbnede klub eller klubvælgeren (`/clubs`). Klubvælgeren i toppen/sidebaren skifter klub.
- **Klubbens side** (`/c/<id>/club`): medlemsliste med roller, invitationskode og -link med Kopiér og Del. Admins kan generere en ny kode og lave nulstillingslinks til medlemmer.
- **Profil:** skift dit navn og log ud. Genvej til klubbens side og (med flere klubber) til klubvælgeren.

**Runde 2**

- **Events:** opret, ret og slet en ølsmagning: titel (forslag "Ølsmagning #N"), dato, starttid (18:30 som standard), valgfri sluttid (gerne efter midnat), sted som fritekst, tema og plan. Eventsiden ligner en invitation med "Åbn i kort" og listen "Øl smagt til dette event" med [+ Tilføj øl]. Kun den, der oprettede eventet, og klubbens admins kan rette og slette det. Slettes et event, bliver øllene i kataloget uden kobling.
- **Overblik:** næste ølsmagning stort (om 3 dage, I morgen!, I aften! 🍻, I gang nu med genveje til [Tilføj øl] og [Sangbog]), derefter "Kommende arrangementer". Uden events: "Ingen kommende ølsmagninger endnu 🍺". Så længe klubben kun har ét medlem, kommer "Inviter dine ølbrødre" først.
- **Kalender:** listevisning (kommende events pr. måned, standard på mobil) og månedsvisning (standard på desktop, alle måneder kan bladres, også tidligere). På mobil viser datoerne prikker, og et tryk viser dagens events og "Opret event denne dag".
- **Ølkatalog:** tilføj, ret og slet øl (navn, alkoholprocent som "5,2" eller "5.2", valgfrit event). Søgning (store/små bogstaver og æ/ø/å), seks sorteringer, filter på event, og advarslen "Den her har I vist smagt før 👀" ved samme navn. Kun den, der tilføjede øllen, og admins kan rette og slette den. Sletning viser, hvor mange ratings der forsvinder med.
- **Ratings:** fem stjerner med halve point (venstre halvdel af en stjerne = halv), gemmes med det samme ("Gemt ✓"), kan ændres og fjernes, og kan styres med piletasterne. Klubbens gennemsnit og antal ratings beregnes ved læsning, og alle kan se hinandens ratings.
- **Kommer senere:** sangbog, steder, værter, kælenavne, eventhistorik og medlemsadministration i runde 3, afstemninger i runde 4. Sangbog-fanen viser en "kommer snart"-side.

Klubbens data er adskilt: en side eller handling i en klub, du ikke er medlem af, giver altid 404 (SPEC §4.4). Det samme gælder events og øl fra en anden klub.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript (strict) · PostgreSQL + Prisma 7 (`@prisma/adapter-pg`) · Better Auth · Zod 4 · Tailwind CSS 4 + shadcn/ui (Radix) · Vitest · Playwright. Deploy: Vercel + Neon. Se SPEC §4.

## Krav

- Node.js 22 og npm
- PostgreSQL 17 lokalt (eller en Neon dev-branch)

## Lokal opsætning

```bash
# 1. Afhængigheder (kører også `prisma generate`)
npm install

# 2. Miljøvariabler: kopiér skabelonen og udfyld den
cp .env.example .env.local
openssl rand -base64 32        # → BETTER_AUTH_SECRET i .env.local

# 3. Databaser (udvikling, E2E og integrationstests)
createdb -h localhost -U postgres -T template0 -E UTF8 olklubben_dev
createdb -h localhost -U postgres -T template0 -E UTF8 olklubben_test
createdb -h localhost -U postgres -T template0 -E UTF8 olklubben_itest   # valgfri: integrationstests opretter den selv

# 4. Migrations og testdata
npm run db:migrate             # prisma migrate dev
npm run db:seed                # prisma/seed.ts

# 5. Start
npm run dev                    # http://localhost:3000
```

**Hvorfor UTC?** Prismas Postgres-adapter (`@prisma/adapter-pg`) sender tidspunkter som UTC uden tidszone og læser dem tilbage, som om forbindelsen kører i UTC. Kørte forbindelsen i en anden tidszone (fx `Europe/Copenhagen`, som er standard på mange lokale installationer), ville alle tidspunkter skrevet af Prisma blive gemt forskudt med UTC-offsettet. Derfor sætter appen selv `TimeZone=UTC` på hver forbindelse (`src/server/db/pg-config.ts`, også i seed-scriptet og E2E-hjælperne), og databasen kræver ingen indstilling. Neons pooled forbindelse (host med `-pooler`) får ikke indstillingen, fordi Neon kører i UTC (GMT) fra start (se deploy-tjeklisten). Rækker skrevet før rettelsen (F-012) er stadig forskudt 1–2 timer. Det er harmløst for testdata. Vil du have rene data, kører du selv `npm run db:reset` (aldrig en AI-agent, se SPEC F-009).

### Miljøfiler

| Fil               | Committes            | Bruges af                                                                                                                |
| ----------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `.env.example`    | ja                   | Skabelon med forklaring af alle variabler                                                                                |
| `.env.local`      | **nej**              | Udvikling: `next dev`/`next build`, Prisma CLI og `tsx`-scripts                                                          |
| `.env.test`       | ja (kun testværdier) | E2E- og integrationstests (`NODE_ENV=test`), peger på `olklubben_test` (integrationstests skifter til `olklubben_itest`) |
| `.env.test.local` | nej                  | Personlige overrides til test                                                                                            |

Alle værktøjer læser filerne med samme prioritet som Next.js (`@next/env`): Prisma CLI via `prisma.config.ts`, og egne `tsx`-scripts ved at importere `scripts/load-env.ts` først. Med `NODE_ENV=test` læses `.env.test`, og `.env.local` ignoreres. Variabler sat i shell eller CI vinder altid over filerne.

Appen validerer miljøet med Zod i `src/env.ts`. Mangler `DATABASE_URL`, `BETTER_AUTH_SECRET` eller `BETTER_AUTH_URL`, stopper den med en fejl, der nævner variablen. Google-login og SMTP er valgfrie og slås kun til, når alle deres variabler er sat.

## Testbrugere

`npm run db:seed` (`prisma/seed.ts`) lægger testdata i udviklingsdatabasen. Scriptet kan køres igen og igen: det opdaterer de samme rækker og nulstiller testbrugernes password. Det nægter at køre i produktion og mod en database, der ikke ligger på `localhost`, medmindre du sætter `SEED_ALLOW_REMOTE=1` (kun til en Neon dev-branch, aldrig produktion).

| Email                | Password       | Klubber                                                 | Efter login (§10.1)                   |
| -------------------- | -------------- | ------------------------------------------------------- | ------------------------------------- |
| `jesper@example.com` | `olklubben123` | Drengene & Bajere (**Admin**), Torsdagsklubben (Medlem) | Drengene & Bajere (sidst aktive klub) |
| `mads@example.com`   | `olklubben123` | Drengene & Bajere (Medlem), Torsdagsklubben (**Admin**) | Klubvælgeren (`/clubs`)               |
| `anders@example.com` | `olklubben123` | Drengene & Bajere (Medlem)                              | Drengene & Bajere (eneste klub)       |

Aktive invitationskoder: **Drengene & Bajere** `BAJE-R234` (`/join/BAJER234`) og **Torsdagsklubben** `TRSD-AG78` (`/join/TRSDAG78`).

Mads lander kun i klubvælgeren, så længe han ikke har åbnet en klub (åbner han en, huskes den). Brugere, man selv opretter, starter i onboarding (`/onboarding`).

**Events, øl og ratings (runde 2).** Datoerne regnes **relativt til i dag** (Europe/Copenhagen), så Overblikket altid har noget at vise. Kører du seed igen, flyttes de til den nye "i dag". Rækker, du selv har oprettet, røres ikke.

| Klub              | Event                                                                    | Hvornår                          | Oprettet af |
| ----------------- | ------------------------------------------------------------------------ | -------------------------------- | ----------- |
| Drengene & Bajere | **Ølsmagning #12** · tema "Belgiske øl" · Hos Mads · plan med linjeskift | for 3 uger siden, 18:30–23:30    | Mads        |
| Drengene & Bajere | **Ølsmagning #13** · tema "Tyske øl" · Hos Jesper                        | om 3 dage, 18:30 (ingen sluttid) | Jesper      |
| Drengene & Bajere | **Juleøl warmup** · tema "Juleøl" · Hos Anders                           | om 4 uger, 19:00–23:00           | Anders      |
| Torsdagsklubben   | **Torsdagsøl** · Bodegaen på hjørnet                                     | om 1 uge, 19:30                  | Mads        |

Ølkataloget i Drengene & Bajere: fire øl fra Ølsmagning #12 (Carlsberg Hvidtøl 1,9 %, Grimbergen Dubbel 6,5 %, Westmalle Tripel 9,5 % og Duvel 8,5 %) med ratings fra Jesper, Mads og Anders (også halve stjerner), Ørbæk Fynsk Forår (5,0 %, uden event, kun Jesper har ratet) og Mikkeller Beer Geek Breakfast (7,5 %, uden event og uden ratings). Torsdagsklubben har ingen øl, så dens katalog viser den tomme tilstand. I Drengene & Bajere må Jesper (admin) rette og slette alt, mens Mads og Anders kun må rette og slette deres egne events og øl (SPEC §5.1). Næste foreslåede titel i Drengene & Bajere er "Ølsmagning #14".

### Email og "Glemt password" lokalt

Uden SMTP-opsætning skrives alle mails som JSON til `.dev-outbox/` (D-024), og terminalen viser en linje med linket. Mappen kan flyttes med `DEV_OUTBOX_DIR`. I produktion uden SMTP sendes ingen mails, og "Glemt password" henviser til en admin, der kan lave et nulstillingslink fra klubbens medlemsliste. Linket kan kun laves til medlemmer, hvis klubber alle administreres af den admin, og aldrig til konti med Google-login (SPEC §6.4). Et nyt link ugyldiggør det forrige.

### Rate limiting

Login, signup, "Glemt password", join-med-kode og opslag af invitationskoder er rate-limited i databasen (`app_rate_limits` og Better Auths `rate_limits`). Login er fx højst 10 forsøg pr. email pr. 15 minutter. Rammer du grænsen lokalt ("Rolig nu 🍺"), så vent, eller sæt `RATE_LIMIT_DISABLED=1` i `.env.local` og genstart `npm run dev`. E2E-tests opretter mange brugere fra samme IP, så `.env.test` sætter flaget. Det virker kun uden for produktion.

## Scripts

| Script                            | Gør                                                                        |
| --------------------------------- | -------------------------------------------------------------------------- |
| `npm run dev`                     | Udviklingsserver på port 3000                                              |
| `npm run build`                   | `prisma generate` + `prisma migrate deploy` + `next build` (som på Vercel) |
| `npm run start`                   | Kører det byggede produktionsbuild                                         |
| `npm run lint`                    | ESLint                                                                     |
| `npm run typecheck`               | `next typegen` (route-typer) + `tsc --noEmit`                              |
| `npm test` / `npm run test:watch` | Unit tests (Vitest), uden database                                         |
| `npm run test:integration`        | Integrationstests (Vitest) mod `olklubben_itest`                           |
| `npm run test:e2e`                | E2E-tests (Playwright) mod testdatabasen                                   |
| `npm run check`                   | `typecheck` + `lint` + `format:check` + `test` (før deploy)                |
| `npm run db:migrate`              | Ny migration fra `prisma/schema.prisma` + anvend den (udvikling)           |
| `npm run db:deploy`               | Anvend ventende migrations (ingen nye)                                     |
| `npm run db:seed`                 | Fyld testdata i via `prisma/seed.ts`                                       |
| `npm run db:reset`                | Slet og genopbyg udviklingsdatabasen (spørger først)                       |
| `npm run db:studio`               | Prisma Studio                                                              |
| `npm run format` / `format:check` | Prettier (inkl. sortering af Tailwind-klasser)                             |

`npm run build` kører `prisma migrate deploy` mod databasen i `.env.local`. Stop `npm run dev` først, da begge bruger `.next/`. Slet `.next/dev`, før du starter `npm run dev` igen efter et build, ellers kan siderne genindlæse i en løkke (`HMR hash mismatch`, SPEC F-013).

## Ruter under `/c/[clubId]` og indlæsning

Next.js sender svaret med HTTP 200, så snart en `loading.tsx` (skeleton) vises. Kalder siden derefter `notFound()`, bliver det en "blød" 404 (SPEC TG-008). Derfor:

- Der ligger **ingen** `loading.tsx` direkte i `src/app/c/[clubId]/`.
- Lister og "ny"-formularer har deres egen `loading.tsx`. Har mappen undersider, ligger listen i en route-gruppe: `(overview)/` (Overblik) og `beers/(catalog)/` (Ølkatalog).
- Et event eller en øl har en **guard-layout** (`events/[eventId]/layout.tsx`, `beers/[beerId]/layout.tsx`), der giver en ægte 404 for ukendte id'er og id'er fra andre klubber, _før_ skeletonen i `(detail)/loading.tsx` vises.
- Sider, der selv kan give 404 (fx `edit/`, kun for opretter eller admin), og catch-all-ruten `[...rest]` har ingen `loading.tsx` over sig.

Reglerne står også i `src/app/c/[clubId]/layout.tsx`.

**Runde 2's ruter og URL-parametre.** Alt valg ligger i URL'en, så refresh, tilbage-knappen og delte links viser det samme. Ugyldige værdier ignoreres (aldrig 404). Links bygges med `src/lib/routes.ts`.

| Rute                              | Parametre                                                                                                                              |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `/c/<id>/calendar`                | `?view=list\|month` (uden: liste under `md`, måned fra `md`), `?month=YYYY-MM`, `?day=YYYY-MM-DD` (valgt dag i mobilens månedsvisning) |
| `/c/<id>/events/new`              | `?date=YYYY-MM-DD` udfylder datoen (fx fra en dag i kalenderen)                                                                        |
| `/c/<id>/events/<eventId>[/edit]` | –                                                                                                                                      |
| `/c/<id>/beers`                   | `?q=` (søgning), `?sort=rating\|most-rated\|newest\|abv-desc\|abv-asc\|name`, `?event=all\|none\|<eventId>`                            |
| `/c/<id>/beers/new`               | `?eventId=` vælger et af klubbens events på forhånd, `?name=` udfylder navnet                                                          |
| `/c/<id>/beers/<beerId>[/edit]`   | –                                                                                                                                      |

**Toasts efter en redirect.** En Server Action, der lykkes, sender videre med `?toast=<nøgle>` (`withToast` i `src/lib/flash-toast.ts`), fx `event-created` eller `beer-deleted`. Klubbens layout viser beskeden én gang (`<FlashToast />`) og fjerner flaget fra adresselinjen. Kun kendte nøgler vises.

## Tests

**Unit (Vitest):** `npm test`. Filer hedder `src/**/*.test.ts` og kører i Node. Domænelogik testes uden database (SPEC §4.2, §15.3). Moduler, der importerer `server-only`, kan godt testes.

**Integration (Vitest):** `npm run test:integration`. Filer hedder `tests/integration/**/*.itest.ts` og kalder de rigtige Server Actions, Better Auth og rate limiteren mod Postgres (SPEC §15.3), fx at ikke-medlemmer får 404, at kun admins kan lave en ny kode eller et nulstillingslink, og at join med en ukendt, tilbagekaldt eller udløbet kode giver E18. Runde 2: `events-beers.itest.ts` tester datalaget (klub-scoping, kommende/igangværende events, gennemsnit, E13, E14, CHECK-constraints), og `round2-actions.itest.ts` tester Server Actions for events, øl og ratings (ikke-medlem og anden klubs id → 404, kun opretter eller admin må rette/slette, dublet-advarsel, event fra en anden klub, ratingværdier, redirects med toast).

- Testene bruger deres egen database, **`olklubben_itest`**, på samme server som `.env.test`'s `DATABASE_URL` (eller `ITEST_DATABASE_URL`, hvis den er sat). Konfigurationen nægter at køre mod en database, hvis navn ikke ender på `_itest`, så hverken udviklings- eller E2E-databasen bliver rørt, og E2E og integrationstests kan køre samtidig.
- Før hver kørsel oprettes databasen, hvis den mangler, migrations anvendes (`prisma migrate deploy`), og alle tabeller tømmes. Efter kørslen tømmes de igen (`tests/integration/global-setup.ts`). Må din Postgres-bruger ikke oprette databaser, så opret den selv én gang (som i lokal opsætning, trin 3).
- Kun `next/headers` (der er ingen Next-request) og `next/cache` er mocket. `notFound()` og `redirect()` er de rigtige og testes via deres `digest` (`expectNotFound`/`expectRedirect` i `tests/integration/helpers.ts`). Brugere oprettes gennem Better Auth (`itest-…@example.test`).
- Testfilerne kører én ad gangen (én database). `npm test` rører aldrig databasen.

**E2E (Playwright):** `npm run test:e2e`. Første gang: `npx playwright install chromium`.

```bash
npm run test:e2e                                  # alle tests, desktop + mobil
npx playwright test e2e/invites.spec.ts           # én fil
npx playwright test --project=mobile              # kun 375 px
npx playwright test -g "Definition of Done"       # efter navn
```

- Testene ligger i `e2e/` og kører i Chromium på desktop (1280 px) og mobil (375 px). Testnavne er på dansk.
- Playwright starter selv appen med `next dev` på **port 3100** med `NODE_ENV=test`, så `.env.test` bruges og **udviklingsdatabasen aldrig røres**. Konfigurationen nægter at køre, hvis databasens navn ikke ender på `_test`.
- Serveren bygger i `.next-e2e/`, så den kan køre samtidig med `npm run dev`.
- Før hver kørsel anvendes migrations på `olklubben_test`, alle tabeller tømmes, og test-outboxen `.dev-outbox/e2e/` slettes (`e2e/global-setup.ts`).
- Hver test opretter sine egne brugere (`e2e-<navn>-<projekt>-<unik>@example.test`) og klubber gennem den rigtige UI, så testene kan køre parallelt.
- Mails fra E2E-serveren (fx nulstillingslinks) ligger som JSON i `.dev-outbox/e2e/` (`e2eOutboxDir` i `e2e/test-env.ts`). De skrives efter svaret, så testene poller efter dem (`waitForEmail` i `e2e/support/outbox.ts`).
- Lokalt genbruges en allerede kørende server på port 3100. Er den startet med gammel kode eller miljø, så stop den først.
- Genindlæser siderne i en løkke under testene (formularer tømmes, `HMR hash mismatch`), er Turbopacks cache forældet (SPEC F-013): stop serveren på 3100 og slet `.next-e2e/dev`.
- Afviser `prisma migrate deploy` testdatabasen (fx fordi en migration er ændret), så nulstil den: `NODE_ENV=test npm run db:reset`.

| Fil                                  | Dækker                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e/round1-dod.spec.ts`             | Runde 1's Definition of Done: (a) opret konto → opret klub → Admin → Overblik → log ud/ind → tilbage i klubben. (b) ven åbner link → opret konto → join.                                                                                                                                                                                     |
| `e2e/multi-club.spec.ts`             | Routing efter login (§10.1–10.3): senest åbnede klub, klubskift, klubvælgeren når klubben er væk (E15), 0 klubber → onboarding, log ud fra onboarding, en Link-prefetch af en anden klub skifter ikke aktiv klub, Profil → "Opret eller join ny klub" med én klub.                                                                           |
| `e2e/invites.spec.ts`                | Ugyldige koder (E18), medlem åbner link (E17), login fra invitation, "Log ud" på invitationen kommer tilbage til den, ny kode gør den gamle ugyldig, medlemmer ser ikke admin-knapper, serveren afviser.                                                                                                                                     |
| `e2e/club-isolation.spec.ts`         | 404 for ikke-medlemmer og ugyldige id'er (E22). Ukendte undersider og events/øl fra en anden klub giver en ægte HTTP 404 inde i AppShell, også for medlemmer, uden at skifte aktiv klub (TG-008). Et medlem, der fjernes, mens appen er åben, får 404 (E16).                                                                                 |
| `e2e/round2-dod.spec.ts`             | Runde 2's Definition of Done som almindeligt medlem: (a) opret event → hero på Overblik → Kalender i liste- og månedsvisning på den rigtige dato. (b) [+ Tilføj øl] fra eventet (eventet udfyldt) → rate 4,5 → en anden rater 3,5 → "4,0" og "2 ratings" → øllen på eventets liste.                                                          |
| `e2e/events.spec.ts`                 | Opret event (titelforslag, validering med fokus, natten over, sommertid → vintertid), eventsiden, rediger, slet med bekræftelse og toast (øllene bliver, E13), 404 efter sletning. Et medlem ser ingen Rediger/Slet på andres events, får 404 på rediger, og serveren afviser et forfalsket request. Admin må rette.                         |
| `e2e/overview-calendar.spec.ts`      | Overblik: hero, kommende arrangementer, tom tilstand, "I morgen!", "I aften! 🍻" og "I gang nu" med genveje. 18:30 på dagen, hvor uret stilles tilbage, er 18:30 på eventsiden, Overblik og i kalenderen (E20). Kalender: liste pr. måned, månedsvisning (chips/prikker, valgt dag, bladring, refresh, I dag), aldrig en anden klubs events. |
| `e2e/beers.spec.ts`                  | Rating med piletaster og tryk på venstre halvdel, ændr, fjern, din rating på kortet. Katalog: søgning (store/små bogstaver, æ/ø/å), sortering (rating med u-ratede sidst, navn A–Å med Æ/Ø/Å sidst), eventfilter, nulstil, URL-state efter reload, ingen events fra andre klubber. Dublet-advarsel (E21). Rettigheder for øl og E14.         |
| `e2e/password-reset.spec.ts`         | "Glemt password" via mail, engangsbrug, en invitation (`?next=`) overlever "Glemt password", udløbet/ugyldigt token, admin-nulstillingslink (fokus på det nye link, et nyt link ugyldiggør det forrige, en nulstilling ugyldiggør alle), nulstilling logger ud overalt, intet link til medlemmer af andre klubber eller Google-brugere.      |
| `e2e/session.spec.ts`                | Sessions forlænges (D-030) via `/api/auth/get-session`, så både databaserækken og cookien får 60 dage igen, men aldrig i en Server Component-render.                                                                                                                                                                                         |
| `e2e/profile-and-deep-links.spec.ts` | Dybt link gennem login, også med en forældet session-cookie, `/profile`, usikker `?next=` ignoreres, navneskift gemmes og ryddes op, "Gem navn" med en forældet session sender til login uden fejlbesked.                                                                                                                                    |
| `e2e/smoke.spec.ts`                  | Serveren svarer, `/` → `/login`, `?next=` på beskyttede sider.                                                                                                                                                                                                                                                                               |
| `e2e/long-names.spec.ts`             | Lange klubnavne (60 tegn, også ét langt ord) brydes på klubsiden, i klubvælgeren og i klubskifteren uden vandret scroll, og det fremhævede menupunkt beholder badgets farver.                                                                                                                                                                |
| `e2e/form-focus.spec.ts`             | Tastatur: en fejl i join-med-kode, opret klub og profilnavn flytter fokus til feltet (§15.2).                                                                                                                                                                                                                                                |     |

Hjælpere: `e2e/fixtures.ts` (`openPage()` giver en side i en ny browserkontekst, fx til en anden bruger), `e2e/support/app.ts` (signup, login, log ud, opret klub, læs invitationslink), `e2e/support/db.ts` (SQL mod testdatabasen, fx fjern medlemskab, lad et token udløbe, ældre en session, slet en brugers sessions, læs `lastActiveClubId`, giv en bruger et Google-login eller indsæt et event, en øl eller en rating direkte med `insertEvent`/`insertBeer`/`insertRating`), `e2e/support/round2.ts` (datoer relativt til i dag i København, næste nat med skift til vintertid, join via link, opret event/øl gennem formularerne, tryk på stjerner) og `e2e/support/outbox.ts`. `expectHydrated()` i `e2e/support/app.ts` venter, til React har hydreret en kontrol, der kun virker med JavaScript (dialog-knapper, stjerner, katalogets selects), før testen klikker efter en fuld sideindlæsning.

## Google-login (OAuth)

Valgfrit. Uden `GOOGLE_CLIENT_ID` og `GOOGLE_CLIENT_SECRET` vises knappen "Fortsæt med Google" ikke.

1. [Google Cloud Console](https://console.cloud.google.com/) → opret et projekt → **APIs & Services → OAuth consent screen**: type "External", appnavn "Ølklubben", scopes `openid`, `email` og `profile`. Udgiv appen ("In production"), ellers kan kun testbrugere logge ind.
2. **Credentials → Create credentials → OAuth client ID**, type "Web application".
3. **Authorized JavaScript origins:** `http://localhost:3000` og `https://<projekt>.vercel.app`.
4. **Authorized redirect URIs** (SPEC §4.8), altid `<BETTER_AUTH_URL>/api/auth/callback/google`:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<projekt>.vercel.app/api/auth/callback/google`
5. Sæt `GOOGLE_CLIENT_ID` og `GOOGLE_CLIENT_SECRET` i `.env.local` og i Vercel (Production). Genstart `npm run dev`.

Google tillader ikke wildcard-URI'er, og preview-URL'er skifter for hvert deploy. Previews bruger derfor email/password, medmindre en fast preview-alias-URL også registreres. Kommer der et eget domæne, skal det tilføjes begge steder i Google og i `BETTER_AUTH_URL` (TG-001). En Google-konto kobles på en eksisterende email/password-konto med samme email, når Google har verificeret emailen (§6.2, D-029).

## Email via Gmail SMTP

Indtil der er et eget domæne, sendes "Glemt password"-mails via en dedikeret Gmail-konto (D-017):

1. Opret en Gmail-konto til klubben (fx `olklubben@gmail.com`), og slå **2-trinsbekræftelse** til.
2. Google-konto → **Sikkerhed → App-passwords** → lav et app-password til "Ølklubben" (16 tegn).
3. Sæt variablerne lokalt og i Vercel (Production og evt. Preview):

   ```text
   SMTP_HOST="smtp.gmail.com"
   SMTP_PORT="465"
   SMTP_USER="olklubben@gmail.com"
   SMTP_PASSWORD="<app-password, uden mellemrum>"
   EMAIL_FROM="Ølklubben <olklubben@gmail.com>"
   ```

4. Test: "Glemt password" med din egen email. Tjek også spam-mappen. Gmail-afsendere havner nemt der (TG-001).

Er SMTP ikke sat op i produktion, viser "Glemt password" "Kontakt en admin i din klub for at få et nulstillingslink.", og admins laver linket fra klubbens medlemsliste (Klubben → nøgleknappen ved medlemmet).

## Deploy til Vercel + Neon

Se SPEC §4.8 for baggrunden. Tjekliste:

- [ ] **Vercel-projekt** fra GitHub-repoet på Hobby-planen. Framework "Next.js", build-kommando `npm run build` (standard), Node 22. Functions kører i `fra1` (`vercel.json`).
- [ ] **Neon Postgres** via Vercel Marketplace (Storage → Neon) i `eu-central-1`. Integrationen sætter forbindelsesvariablerne pr. miljø. Tjek, at `DATABASE_URL` er den **pooled** streng (host med `-pooler`), og at `DATABASE_URL_UNPOOLED` (den **direkte**) også er sat: migrations bruger den. Tjek, at `SHOW timezone` giver `GMT`/`UTC`.
- [ ] **Sæt ikke `DIRECT_URL` i Vercel.** Den er kun til lokal/manuel brug. En værdi sat i Vercel-projektet er den samme for alle Preview-deploys, så et preview ville migrere den database, den peger på (typisk produktion). Builds på Vercel stopper derfor med en fejl, hvis `DIRECT_URL` er sat for Preview, eller hvis migrations-URL'en er pooled (`src/lib/migration-url.ts`).
- [ ] **Preview branching:** slå preview-branches til i Neon-integrationens indstillinger (Vercel → Storage → Neon: en database-branch pr. Preview-deploy), så hvert Preview-deploy får sin egen Neon-branch med egne `DATABASE_URL`/`DATABASE_URL_UNPOOLED`. Uden det bruger previews den database, integrationen har sat for Preview-miljøet, og det kan være produktionens.
- [ ] **Miljøvariabler** (Project → Settings → Environment Variables), pr. miljø:
  - `BETTER_AUTH_SECRET`: ny værdi pr. miljø (`openssl rand -base64 32`).
  - `BETTER_AUTH_URL`: `https://<projekt>.vercel.app` i Production. Previews skal pege på den URL, der testes på (fx en fast branch-alias).
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (valgfrit, se ovenfor).
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` (valgfrit, se ovenfor).
  - Sæt **aldrig** `RATE_LIMIT_DISABLED` eller `DEV_OUTBOX_DIR` (de ignoreres i produktion).
- [ ] **Migrations:** `npm run build` kører `prisma migrate deploy` ved hvert deploy mod `DATABASE_URL_UNPOOLED` (lokalt `DIRECT_URL` eller `DATABASE_URL`), så schemaet altid matcher koden. Migrations skal være bagudkompatible. Previews migrerer kun deres egen Neon-branch, aldrig produktionsdata.
- [ ] **Før deploy** (der er endnu ingen CI, og Vercels build type-checker, men linter og tester ikke):
  1. `npm run check` (typecheck, lint, Prettier og unit tests) og `npm run test:integration`.
  2. `npm run build && npm run start` lokalt med produktionslignende miljø: ingen SMTP-variabler og ingen `RATE_LIMIT_DISABLED`. E2E kører kun `next dev`, så det her er eneste sted, produktionsgrenene prøves (Link-prefetch, rate limits, ingen dev-outbox). `npm run build` migrerer databasen i `.env.local`, og `next start` læser `.env.local` og `.env.production` (stop `npm run dev` først).
  3. Gå Runde 1's og Runde 2's Definition of Done igennem i hånden med testbrugere (`…@example.test`, slet dem bagefter): (a) opret konto → opret klub → du er Admin og lander i klubben efter log ud/ind, (b) en anden bruger åbner invitationslinket, opretter konto og joiner, (c) opret et event → det er på Overblik og i Kalender, (d) tilføj en øl til eventet → rate den → klubbens gennemsnit vises.
  4. Tjek, at "Glemt password" viser "Kontakt en admin i din klub for at få et nulstillingslink." (ingen SMTP i produktion).
  5. Tjek, at Link-prefetch ikke skifter den huskede klub (`rememberActiveClub` i `src/server/auth/session.ts`): som en bruger med to klubber åbner du `/clubs` og venter et par sekunder, så linkene til klubberne er prefetchet. Åbn så `/`: du skal lande i den klub, du sidst åbnede, ikke den sidste i listen.
- [ ] **Første deploy:** åbn `https://<projekt>.vercel.app/api/auth/ok` (skal svare `{"ok":true}`), opret din konto, opret klubben, og del invitationslinket.
- [ ] **Testdata:** kør aldrig `npm run db:seed` mod produktion.
