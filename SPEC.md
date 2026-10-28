# Ølklubben – Produkt-, UX- og teknisk specifikation

> **Status:** Udkast v2 · **Sidst opdateret:** 2026-10-18
> **Ejer:** Jesper
> **Formål med dokumentet:** Én samlet kilde til sandhed for produktet. Både mennesker og AI-agenter skal kunne vende tilbage hertil, før de bygger, ændrer eller retter noget.

---

## 0. Sådan bruges dokumentet

* **Afsnit 1–3** forklarer *hvorfor* og *hvad*: vision, ordliste og principper.
* **Afsnit 4–9** forklarer *hvordan*: arkitektur, roller, routing og hver enkelt feature i detaljer.
* **Afsnit 10–15** er referencemateriale: flows, datamodel, edge cases, design og kvalitetskrav.
* **Afsnit 16–18** handler om rækkefølge og scope: MVP, senere features og åbne spørgsmål.
* **Afsnit 19** er **AI-agentens arbejdsområde**: arbejdsregler, implementeringsstatus, beslutningslog og log over fejl og rettelser.

Markeringer brugt i dokumentet:

* **[MVP]**: skal med i første version.
* **[SENERE]**: skal ikke bygges nu, men arkitekturen må ikke forhindre det.
* **[BESLUTNING]**: et valg der er truffet for at fjerne tvetydighed. Kan ændres, men så skal det ske i beslutningsloggen (§19.3).
* **[ÅBENT]**: uafklaret spørgsmål. Se §18.

---

# 1. Produktvision

Ølklubben er en lille, social webapp for private ølklubber. Den samler det, klubben allerede gør fysisk, ét digitalt sted:

* Holde styr på kommende ølsmagninger.
* Planlægge og oprette events, også via afstemning om dato og sted.
* Gemme og rate de øl, klubben har drukket.
* Samle klubbens sangbog.
* Give hvert medlem en personlig profil, med mulighed for at være medlem af flere klubber.
* Lade brugerne rapportere fejl og foreslå nye features direkte i appen.

Appen skal være **klubbens digitale samlingspunkt og hukommelse**, ikke et administrationssystem.

Når man åbner appen, skal den først og fremmest svare på:

> **"Hvornår ses vi næste gang? Hvor? Hvad skal vi?"**

Derefter samler den klubbens historie:

> **"Hvilke øl har vi drukket? Hvad syntes vi om dem? Hvad synger vi?"**

Og den gør planlægning nem:

> **"Hvor og hvornår skal vi mødes næste gang?"**

Tonen er **personlig, hyggelig, lidt fjollet og med en tydelig identitet**, men teknisk solid og nem at bruge. Den skal føles som *vores ølklub*.

### 1.1 Brugskontekst (vigtig for alle designvalg)

* **Mobilen er primær.** Meget brug sker *under* en ølsmagning: man står med en øl i hånden, der er dårligt lys, og man har måske fået et par stykker. Store trykflader, få trin og tydelig tekst er vigtige.
* **Klubberne er små** (typisk 5–20 medlemmer), og medlemmerne kender hinanden. Det tillader en demokratisk og tillidsbaseret model (fx må alle redigere steder).
* **Brugen er lav, men regelmæssig**: nogle gange om måneden. Appen skal være selvforklarende hver gang, fordi ingen husker komplicerede flows.

---

# 2. Ordliste

Den samme term bruges konsekvent i UI, kode og dokumentation.

| Dansk (UI)      | Kode (engelsk)    | Betydning |
|-----------------|-------------------|-----------|
| Klub            | `Club`            | En privat ølklub. Alt indhold hører til præcis én klub. |
| Medlem          | `Membership`      | Relationen mellem en bruger og en klub, med en rolle. |
| Aktiv klub      | `activeClub`      | Den klub, brugeren lige nu ser appen igennem. |
| Event           | `Event`           | Et bekræftet arrangement med dato, tid og sted. |
| Vært(er)        | `EventHost`       | Den eller de brugere, der er ansvarlige for et event. |
| Afstemning      | `Poll`            | Et planlægnings-event, hvor medlemmerne stemmer om dato og/eller sted. (Kaldet "stemmable event" i v1 af teksten.) |
| Valgmulighed    | `PollOption`      | En dato eller et sted, man kan stemme på. |
| Sted            | `Place`           | En lokation, fx "Hos Jesper" eller "Den lokale bar". |
| Stedets ejer(e) | `PlaceOwner`      | Medlemmer, der "hører til" et sted, og som bliver værter, hvis stedet vinder en afstemning. |
| Øl              | `Beer`            | En øl i klubbens katalog. |
| Rating          | `BeerRating`      | Ét medlems vurdering af én øl (1–5, halve point). |
| Klubbens rating | (beregnet)        | Gennemsnittet af alle ratings på en øl. Gemmes aldrig manuelt. |
| Sang            | `Song`            | En sang i klubbens sangbog. |
| Feedback        | `Feedback`        | En fejlrapport (bug) eller et feature-ønske om selve appen. Fælles for alle brugere, ikke klub-specifik. |
| App-admin       | `isAppAdmin`      | Den, der udvikler/driver appen (Jesper). Kan ændre status på feedback. Er ikke en klubrolle. |
| Kælenavn        | `nickname`        | Det navn, der vises i klubbens UI. |
| Invitationskode | `Invite`          | Kode/link, der giver adgang til at joine en klub. |

---

# 3. Overordnede principper

## 3.1 Klubben er centrum

* Når en bruger er logget ind, ser appen **altid** verden gennem én aktiv klub.
* Den aktive klub er altid synlig i navigationen (klubnavn i toppen/sidebaren).
* Har brugeren kun én klub, skal klubben **aldrig** vælges manuelt.
* Har brugeren flere klubber, kan der skiftes ligesom ved profilskift på Instagram: tryk på klubnavnet, vælg en anden klub.

## 3.2 Kalenderen er hjertet

Det første, man ser i en klub, er **næste event, stort og tydeligt**. Ikke et dashboard med små widgets.

## 3.3 Tillid inden for klubben, mure mellem klubber

* **Inden for** en klub er modellen demokratisk: alle medlemmer kan oprette events, tilføje øl, oprette og redigere steder og starte afstemninger.
* **Mellem** klubber er isolationen absolut: en bruger må aldrig kunne se, ændre eller udlede noget om en klub, de ikke er medlem af. Det håndhæves server-side (§4.4).
* **Undtagelse – feedback (§9.9):** Fejlrapporter og feature-ønsker handler om appen, ikke om en klub. Derfor er de fælles for alle brugere. De må aldrig automatisk afsløre klubdata (fx klubnavn eller URL'er med klub-id) for andre brugere.

## 3.4 Beregn i stedet for at gemme

Afledte værdier (gennemsnitlig rating, antal stemmer, "alle har stemt") **beregnes** ud fra kildedata. Det gør data robust og forhindrer, at tal kommer ud af sync.

## 3.5 Hyggelig, ikke kedelig

Mikrotekster må gerne have humor ("Skål! Din stemme er gemt 🍻"). Fejlbeskeder skal stadig være klare og handlingsrettede.

---

# 4. Teknologi og arkitektur

## 4.1 Anbefalet stack [BESLUTNING – kan ændres, se §18]

| Lag | Valg | Begrundelse |
|---|---|---|
| Framework | **Next.js (App Router)** + **React** + **TypeScript (strict)** | Krav fra brief. Server Components og Server Actions giver naturlig server-side validering og autorisation. |
| Database | **PostgreSQL** (fx Neon eller Supabase som hosting) | Relationelle data med mange constraints (unikke ratings, ét sted pr. stemmeseddel). Postgres understøtter partial unique indexes og check constraints. |
| ORM | **Prisma** | Typesikre queries, migrations og god TypeScript-integration. (Drizzle er et ligeværdigt alternativ.) |
| Auth | **Better Auth** (alternativt Auth.js) | Understøtter både email/password og Google, gemmer sessions i databasen og har adapter til Prisma. Auth0 Universal Login kobles på som OIDC-udbyder via Better Auths `genericOAuth` (D-166). |
| Validering | **Zod** | Ét schema pr. input, som deles mellem formular (client) og Server Action (server). |
| Styling | **Tailwind CSS** + **shadcn/ui** (Radix-primitiver) | Tilgængelige basiskomponenter, som vi selv ejer og kan style til ølklub-identiteten. |
| Datoer | **date-fns** + **@date-fns/tz** | Al visning sker i `Europe/Copenhagen` (§4.6). |
| Email | **Gmail SMTP** (`nodemailer`) indtil videre, senere **Resend** | Nødvendig til "Glemt password". Der er intet eget domæne endnu, se §6.4 og D-017. |
| Tests | **Vitest** (domænelogik) + **Playwright** (kritiske flows) | Se §15.3. |
| Hosting | **Vercel** (Hobby) + **Neon Postgres** via Vercel Marketplace | Besluttet (D-016). Gratis tiers dækker en lille klub. Detaljer i §4.8. |

## 4.2 Lagdeling

Domænelogik holdes adskilt fra UI. Retningen for afhængigheder er **UI → actions → domain → db**, aldrig omvendt.

```text
src/
  app/                      # Next.js routes (kun komposition + data-hentning)
    (auth)/                 # login, signup, forgot-password, reset-password
    (onboarding)/           # onboarding, clubs (klubvælger), join/[code]
    c/[clubId]/             # alt klub-scopet indhold
    feedback/               # app-dækkende fejl og ønsker (§9.9): (list)/, new/, [feedbackId]/(detail)/, [feedbackId]/edit/ (D-147, D-148)
  components/
    ui/                     # generiske primitiver (Button, Modal, ConfirmDialog …)
    features/               # feature-komponenter (EventCard, BeerRating …)
      forms/                # useActionForm + feltkomponenter, fælles for alle formularer (D-109)
      feedback/             # FeedbackForm, FeedbackCard, filtre, 👍, moderation, FeedbackShell, ReportErrorLink (§9.9)
  server/
    auth/                   # session-helpers, requireUser, requireMembership
    domain/                 # ren forretningslogik, ingen React og ingen Next-imports
      events/
      beers/
      polls/                # fx tally(), resolveWinner(), shouldAutoClose()
      places/
      clubs/
      songs/                # song-text (vers, akkorder, etiketter), søgning, titler og bogstaver (D-122, D-123)
      feedback/             # status, page-path (E26), app-admin, permissions, votes, list-params, new-params, similar, cli-format (D-141–D-146)
    actions/                # Server Actions: valider → autoriser → kald domain → revalidate
    db/                     # Kun Prisma client (+ pg-config, seed-guard, locks.ts: al rå SQL til låse, D-102)
    clubs/, users/, places/ … # Pr. feature: queries.ts + mutations.ts (+ access.ts med require*-guards), altid scopet på clubId. app/** og actions/** må ikke importere @/server/db (ESLint, D-054)
    feedback/               # access.ts (requireFeedback, getFeedbackViewer), queries.ts, mutations.ts – app-dækkende, intet clubId (§9.9)
  lib/
    validation/             # Zod-schemas, delt mellem client og server
    form-data.ts            # readFormValues (listefelter, loft, exclude), bruges af formularer og actions
    format/                 # dato-, tal- og navneformattering (da-DK)
prisma/
  schema.prisma
  migrations/
  seed.ts                   # testdata: 2 klubber, brugere, events, øl, opdigtede sange, steder
scripts/
  import-songbook.ts        # sangbogsimport (CLI, §9.6, D-126) + songbook/ (pdftohtml, parser, plan, guards)
  list-feedback.ts          # åbne feedback-rapporter til AI-agenten (læser kun, §9.9, D-146)
```

Regler:

* **Domænefunktioner er rene, hvor det er muligt** (fx `tallyPoll(options, votes) → result`), så de kan unit-testes uden database.
* **Ingen forretningslogik i komponenter.** Komponenter viser data og kalder actions.
* **Ingen duplikeret logik** mellem client og server. Delte regler bor i `lib/validation` eller `server/domain`.
* **Seedet og testene bruger kun opdigtede sange** (5 i Torsdagsklubben, id'er `…d1`–`…d5`; Drengene & Bajere får ingen). Rigtige sangtekster og titler kommer aldrig i repoet (D-120).

## 4.3 Server Actions-mønster

Hver handling, der ændrer data, følger samme opskrift:

```text
1. Parse input med Zod              → ugyldigt input = valideringsfejl til formularen
2. requireUser()                    → ikke logget ind = redirect til /login
3. requireMembership(clubId, role?) → ikke medlem = notFound()
4. Hent ressource MED clubId        → findes ikke i klubben = notFound()
5. Tjek ressource-rettighed         → fx "er du opretter, vært eller admin?"
6. Kald domænefunktion (i en transaction, hvis flere tabeller ændres)
7. revalidatePath / redirect
```

Actions returnerer et ensartet resultat: `{ ok: true, data } | { ok: false, error: { code, message, fieldErrors? } }`.

## 4.4 Club isolation (sikkerhedskrav)

* **Alle** klub-ressourcer har `clubId`. Opslag sker altid på `(id, clubId)`, aldrig kun `id`.
* `clubId` fra URL'en er input, ikke bevis. Medlemskab tjekkes på hver request.
* En ressource fra en anden klub giver **404** (ikke 403), så vi ikke afslører, at den findes.
* Krydsrelationer valideres: en øl må kun knyttes til et event i *samme* klub, en stemme kun til en valgmulighed i *samme* afstemning, en stedejer skal være medlem af stedets klub osv.
* Client-side skjulte knapper er kun UX. Serveren er autoritativ.

## 4.5 Aktiv klub og routing [BESLUTNING]

Den aktive klub ligger i **URL'en**: `/c/[clubId]/...`.

Hvorfor: refresh mister ikke state, links til et event virker direkte (fx delt i en gruppechat), og to faner kan vise to forskellige klubber.

Derudover gemmes `User.lastActiveClubId`, så `/` kan sende brugeren direkte til den senest brugte klub (§10.2–10.3).

## 4.6 Tid og tidszoner

* Tidspunkter gemmes som `timestamptz` (UTC).
* Al visning og alt input sker i **Europe/Copenhagen** (MVP: fast tidszone, ikke pr. bruger).
* Formatering følger dansk: "fredag 23. oktober", "18:30", "4,3", "5,2 %".
* Sommertid/vintertid håndteres af tz-biblioteket. Tidszoneberegning må aldrig håndskrives.

## 4.7 Sikkerhed

* Passwords hashes af auth-biblioteket (aldrig custom).
* Rate limiting på login, signup, glemt password og join-med-kode. Profil: "Skift password", "Skift email" og "Tilføj password" højst 10 forsøg pr. bruger pr. 15 min; de to første også 10 pr. IP (`/change-password`, `/verify-password`, D-106, D-151, D-152). Feedback: højst 10 nye rapporter pr. bruger pr. døgn (`feedback:create:user:<id>`, §9.9).
* Invitationskoder er tilfældige og ikke gættelige (§7.3).
* Ingen hemmeligheder i client-bundles. Miljøvariabler valideres ved opstart (fx med Zod).
* Eksterne logins kun via redirect-flowet med appens egne parametre (D-166): et id-token fra klienten afvises på alle stier (`ID_TOKEN_SIGN_IN_DISABLED`), og `scopes` og `additionalParams` afvises på login-endpoints, undtagen præcis `{ prompt: "login" }`. Auth0's id-tokens verificeres mod tenantens JWKS (`requireIdTokenVerification`), og kun Auth0-forbindelserne Google og database er tilladt.
* Better Auth-endpoints, appen ikke bruger, er lukket over HTTP (D-165): `/unlink-account`, `/get-access-token`, `/refresh-token`, `/account-info` og `/update-user` (profilændringer går gennem appens egne Server Actions). Google-login kun via redirect-flowet med PKCE (ingen login med et løst id-token), og Googles tokens gemmes krypteret.

## 4.8 Deployment på Vercel [BESLUTNING]

Appen deployes på **Vercel**. Det påvirker en række tekniske valg:

**Plan**
* Start på **Hobby-planen** (gratis). Den er beregnet til ikke-kommercielle, personlige projekter, og det passer til en privat ølklub.
* Hobby-begrænsninger, der påvirker designet:
  * **Cron jobs kører højst én gang i døgnet** (og ikke på et præcist minut). Afstemninger må derfor **ikke** afhænge af cron for at lukke til tiden. *Lazy close* er den primære mekanisme (§9.7.5), og den daglige cron er kun et sikkerhedsnet.
  * Serverless functions har en begrænset køretid. Ingen tunge jobs i requests. Sangbogsimport køres lokalt som script, ikke på Vercel.

**Database**
* **Neon Postgres via Vercel Marketplace.** Miljøvariablerne sættes automatisk i Vercel-projektet.
* Serverless betyder mange korte forbindelser. Brug derfor Neons **pooled connection string** til appen (`DATABASE_URL`) og en **direkte** forbindelse til migrations (`DIRECT_URL`). Overvej Prismas Neon driver adapter.
* **Region:** Vercel functions i `fra1` (Frankfurt) og Neon i `eu-central-1`. Det giver lav latency mellem app og database, og data bliver i EU (GDPR).

**Miljøer**

| Miljø | Hvornår | Database |
|---|---|---|
| Development | Lokalt (`next dev`) | Lokal Postgres (Docker) eller en Neon dev-branch |
| Preview | Automatisk pr. branch/PR | Separat Neon-branch, **aldrig** produktionsdata |
| Production | Push til `main` | Neon main-branch |

**Migrations**
* `prisma migrate deploy` køres som en del af build-steppet (fx `"build": "prisma migrate deploy && next build"`), så schemaet altid matcher koden.
* Migrations skal være bagudkompatible, hvor det er muligt (tilføj kolonner før kode bruger dem, og fjern dem først i en senere deploy).

**Authentication på Vercel**
* **Appens base-URL (D-164):** på Vercel Production er den `https://${VERCEL_PROJECT_PRODUCTION_URL}`, Vercels systemvariabel for projektets produktionsdomæne (det korteste: et eget domæne, når det kommer, ellers den faste `*.vercel.app`). `BETTER_AUTH_URL` sættes ikke i Production; er den sat og anderledes, ignoreres den med en advarsel i loggen. Lokalt og på previews bruges `BETTER_AUTH_URL`. Base-URL'en tages aldrig fra requestens `Host`-header (nulstillingslinks må ikke kunne forfalskes).
* **Google OAuth og preview-deploys:** Google accepterer ikke wildcard-redirect-URI'er, og preview-URL'er skifter for hver deploy. Google-login testes derfor lokalt og i produktion. På previews bruges email/password (eller en fast preview-alias-URL, der er registreret hos Google).
* Registrér redirect-URI'er for `http://localhost:3000` og produktions-URL'en i Google Cloud Console. Indtil der kommer et eget domæne, er produktions-URL'en den faste `https://<projekt>.vercel.app`. Kommer der et domæne senere, skal det tilføjes i Google Cloud Console; appens base-URL følger med af sig selv (D-164).

**Miljøvariabler (minimum)**

```text
DATABASE_URL            # pooled (Neon)
DIRECT_URL              # direkte, til migrations – KUN lokalt/manuelt, aldrig i Vercel (D-058)
DATABASE_URL_UNPOOLED   # sættes af Neon-integrationen pr. miljø/preview-branch; bruges til migrations på Vercel (D-058)
BETTER_AUTH_SECRET
BETTER_AUTH_URL         # lokalt og på previews; IKKE i Production, dér bruges VERCEL_PROJECT_PRODUCTION_URL (D-164)
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET    # kun uden Auth0
AUTH0_DOMAIN            # Auth0 Universal Login (D-166): tenantens hostname uden https://
AUTH0_CLIENT_ID
AUTH0_CLIENT_SECRET
SMTP_HOST               # smtp.gmail.com (midlertidigt, §6.4)
SMTP_USER
SMTP_PASSWORD           # Gmail app password, ikke kontoens rigtige password
EMAIL_FROM
# RESEND_API_KEY        # når der kommer et eget domæne
CRON_SECRET             # mindst 16 tegn; Vercel Cron sender den som Bearer-token. Uden den svarer ruten 503 (D-131)
APP_ADMIN_EMAILS        # kommasepareret liste over app-admins (feedback-status, §9.9). Trimmes, lowercases, dubletter fjernes;
                        # en post, der ikke er en email, stopper opstarten. Tom i produktion → advarsel i loggen (D-142)
```

Alle valideres med Zod ved opstart (`src/env.ts`). Hemmeligheder ligger kun i Vercels miljøvariabler og i en lokal `.env.local`, der aldrig committes.

**Cron** (bygget i runde 4, D-131)
* `vercel.json` definerer et dagligt kald til `GET /api/cron/close-polls` kl. 04:00 UTC (`"schedule": "0 4 * * *"`).
* Route'en sammenligner `Authorization: Bearer ${CRON_SECRET}` tidskonstant (`src/server/cron/auth.ts`) og lukker for hver klub med åbne afstemninger dem, hvis frist er gået, **eller** hvor alle nuværende medlemmer har stemt (idempotent, §9.7.5). Den revaliderer de klubber, den har ændret.
* Svar: `503 {"error":"CRON_SECRET mangler"}` (og en linje i loggen), når variablen ikke er sat; `401 {"error":"Ikke autoriseret"}` ved et manglende eller forkert token; ellers `200 { clubs, closed, awaiting, failed }`. En fejl i én afstemning stopper ikke de andre (`failed` tælles).
* `/api` ligger uden for proxyens matcher, så ruten bruger ingen session.

**Rate limiting**
* Serverless functions deler ikke hukommelse, så in-memory rate limiting virker ikke. Brug enten auth-bibliotekets database-baserede rate limiting eller en ekstern store (fx Upstash Redis via Vercel Marketplace).
* **Implementeret (D-028):** Login, signup, glemt password og nulstilling begrænses i en Better Auth `hooks.before`-middleware med appens egen database-limiter (`app_rate_limits`, `src/server/rate-limit.ts`), fordi Better Auths indbyggede limiter ikke dækker `auth.api.*`-kald fra Server Actions. Den indbyggede limiter (database-lager) dækker resten af auth-endpoints. Join-med-kode bruger samme limiter, og det samme gør feedback (10 rapporter pr. bruger pr. døgn, D-145). `RATE_LIMIT_DISABLED` slår den fra i test-miljøet (aldrig i produktion).

---

# 5. Roller og rettigheder

To roller pr. medlemskab: **Member** og **Admin** [BESLUTNING, D-018].

* Den, der **opretter klubben, bliver automatisk Admin**.
* Der kan være **flere admins**, og de er **ligestillede**. Der findes ingen særlig ejer-rolle.
* En klub skal **altid have mindst én admin**. Det håndhæves i domænelaget inden for en transaction, der låser klubbens række (D-102), fordi det ikke kan udtrykkes som en simpel database-constraint (§11).

## 5.1 Rettighedsmatrix

✅ = tilladt · 🟡 = kun egne / hvis man er opretter, vært eller ejer · ❌ = ikke tilladt

| Handling | Member | Admin |
|---|:-:|:-:|
| Se klubbens events, øl, sange og steder | ✅ | ✅ |
| Oprette event | ✅ | ✅ |
| Redigere/slette event | 🟡 opretter eller vært (D-098) | ✅ |
| Starte afstemning | ✅ | ✅ |
| Stemme | ✅ | ✅ |
| Redigere afstemning (titel, tema, beskrivelse, forlænge frist; datoer, starttid og steder indtil første stemme; kun mens den er åben, D-133, D-153) | 🟡 opretter | ✅ |
| Afslutte/annullere afstemning, vælge vinder ved uafgjort | 🟡 opretter, så længe vedkommende er medlem (E11) | ✅ |
| Tilføje øl | ✅ | ✅ |
| Redigere/slette øl | 🟡 opretter | ✅ |
| Rate øl (egen rating) | ✅ | ✅ |
| Oprette og redigere steder (navn, adresse, beskrivelse), også arkiverede | ✅ | ✅ |
| Sætte sig selv på / fjerne sig selv som stedejer | ✅ | ✅ |
| Arkivere et brugt sted | 🟡 stedejer | ✅ |
| Slette et sted, der aldrig er brugt | 🟡 stedejer eller opretter | ✅ |
| Gendanne et arkiveret sted | 🟡 stedejer | ✅ |
| Fjerne andre som stedejere | ❌ | ✅ |
| Se og dele klubbens invitationslink | ✅ | ✅ |
| Generere ny invitationskode (ugyldiggør den gamle) | ❌ | ✅ |
| Administrere sangbog (opret/rediger/slet sang) | ❌ | ✅ |
| Redigere klubinfo (navn, beskrivelse) | ❌ | ✅ |
| Fjerne medlemmer (også andre admins) | ❌ | ✅ (ikke den sidste admin) |
| Generere nulstillingslink til et medlems password (§6.4) | ❌ | 🟡 kun medlemmer, hvis klubber alle administreres af admin'en, og ikke konti med Google-login (D-046) |
| Gøre medlem til Admin | ❌ | ✅ |
| Fjerne admin-rollen fra en admin (også sig selv) | ❌ | ✅ (ikke den sidste admin) |
| Slette klubben | ❌ | ✅ (kræver at man skriver klubnavnet) |
| Forlade klubben | ✅ | ✅ (ikke den sidste admin, se §7.4) |

Rettighedstjek implementeres som rene funktioner i `server/domain` (fx `canEditEvent(membership, event)`) og genbruges både til at skjule knapper og til at håndhæve på serveren.

> **Note om stedejere:** "Alle kan sætte sig selv på som ejer" betyder kun sig selv. Et medlem kan ikke sætte *andre* på som ejer. Admins må gerne fjerne ejere (oprydning). Se §9.4. Fordi ejerskab er selvvalgt, er "kun stedejer" ved arkivering og gendannelse en bremse mod fejltryk, ikke en adgangskontrol: et medlem kan gøre sig selv til ejer først (D-100, §3.3).

---

# 6. Authentication og konti

## 6.1 Opret bruger [MVP]

Felter: **Navn**, **Email**, **Password** (min. 8 tegn) og eventuelt "Gentag password".
Efter oprettelse logges brugeren ind og sendes videre efter §10.1.

## 6.2 "Fortsæt med Google" [MVP]

* Opretter en ny bruger eller finder den eksisterende Google-bruger. Google skal have bekræftet emailen; ellers "Google har ikke bekræftet din email, så vi kan ikke bruge Google-kontoen." og der oprettes intet.
* **Auth0 Universal Login [BESLUTNING, D-166]:** Er Auth0 sat op, viser login og opret konto **"Fortsæt med Auth0"** i stedet for Google. Knappen sender til Auth0's login-side, hvor Google tilbydes, og man har samme identitet som i andre apps på tenanten. Alle regler her gælder for alle eksterne logins (Google direkte og Auth0). Kun Auth0-forbindelserne Google og Auth0's egen database er tilladt; andre giver "Den måde at logge ind på i Auth0 er ikke tilladt her." "Log ud" logger også ud af Auth0. Teksterne nedenfor nævner den udbyder, der er sat op.
* **Account linking [BESLUTNING, D-165]:** Google kobles **aldrig automatisk** på en eksisterende konto. Har emailen allerede en email/password-konto, giver "Fortsæt med Google": "Der findes allerede en konto med den email. Log ind med email og password, og forbind Google på din profil. Kender du ikke passwordet, så brug "Glemt password"." Ejeren logger ind med password og trykker **"Forbind Google"** på Profil (§9.8). Grund: password-konti verificerer ikke email (D-029), så en automatisk kobling ville give en, der har oprettet en konto på en andens adresse, adgang sammen med ejeren (TG-002).
* En Google-konto hører altid til kontoens egen, bekræftede email: kobling kræver samme email, og "Skift email" kobler Google fra (§9.8).
* Navn og profilbillede hentes fra Google ved første login. Kobles Google på en eksisterende konto, hentes billedet, hvis kontoen ikke har et, og emailen markeres som bekræftet.

## 6.3 Login [MVP]

Email + password eller Google. Fejlbeskeden er generisk ("Forkert email eller password"), så den ikke afslører, om emailen findes. (Google-beskeden "Der findes allerede en konto med den email" vises kun til den, der lige har bevist over for Google, at emailen er deres.)

## 6.4 Glemt password [MVP]

Brugeren indtaster sin email og får et link med en engangs-token (udløber efter 1 time). Svaret er altid "Hvis emailen findes, har vi sendt et link" for ikke at afsløre eksisterende konti.

**Afsendelse af email uden eget domæne [BESLUTNING, D-017]:** Appen har indtil videre ikke sit eget domæne (kun `*.vercel.app`). Tjenester som Resend kræver et verificeret domæne for at kunne sende til andre end ejeren selv. Derfor:

* Al email-afsendelse går gennem ét interface (`server/email/sendEmail()`), så udbyderen kan skiftes uden at røre resten af koden.
* **Midlertidig udbyder: Gmail SMTP** (via *app password* på en dedikeret Gmail-konto og `nodemailer`). Det virker uden eget domæne og har rigeligt med kapacitet til en lille klub.
* **Fallback uden email:** Admins kan på medlemslisten generere et **engangs-nulstillingslink** til et medlem (udløber efter 1 time) og dele det fx i gruppechatten. Det er nyttigt uanset udbyder.
  * **Begrænsning (D-046):** Kun til medlemmer, hvis klubber *alle* administreres af den admin, der laver linket, og aldrig til konti med Google-login. Afvisningen er generisk og nævner aldrig andre klubber (§3.3).
  * Et nyt link ugyldiggør det forrige, og en gennemført nulstilling ugyldiggør alle udestående links (D-047).
* Er email ikke konfigureret (manglende miljøvariabler), viser "Glemt password"-siden: "Kontakt en admin i din klub for at få et nulstillingslink."
* Medlemmer, der logger ind med Google, har ikke brug for nulstilling.
* **Har en anden oprettet en konto på ens email** (D-029), tager ejeren den tilbage med "Glemt password": nulstillingen logger alle andre ud og ugyldiggør alle links. Det kræver, at email er sat op i produktion; uden SMTP kan admin-linket kun bruges inden for egen klub (D-046), og så må adressen ryddes manuelt (D-165).
* En nulstilling via "Glemt password" på en ren Google-konto opretter også et password-login (Better Auths `resetPassword` laver en credential-konto, når der ingen er). Kontoen beholder sit Google-login, så admin-links stadig afvises (D-046). Det svarer til "Tilføj password" på Profil (§9.8, D-152), som ikke kræver email.
* **Når der kommer et domæne:** skift til Resend (eller lignende), verificér domænet (SPF/DKIM) og opdatér `EMAIL_FROM`. Se §19.5, TG-001.

## 6.5 Invitationslink og login

Åbner en ikke-logget-ind bruger `/join/ABC123`, gemmes koden. Efter login/signup fortsætter brugeren automatisk til join-bekræftelsen. Der må ikke være et ekstra trin, hvor koden skal indtastes igen.

---

# 7. Klubber, medlemskab og invitationer

## 7.1 Klub

En klub har: **navn**, id, oprettelsesdato, medlemmer (med roller), invitationskode og eventuelt en kort beskrivelse (højst 300 tegn, D-110).

Den, der opretter klubben, bliver automatisk **Admin** (§5). Admins retter navn og beskrivelse på `/c/[clubId]/club/edit` (D-110).

## 7.2 Onboarding [MVP]

Har brugeren ingen klubber, vises:

```text
Velkommen ombord! 🍺

Du er ikke medlem af nogen klub endnu.

[ Opret ølklub ]
[ Join en ølklub ]
```

* **Opret ølklub:** indtast navn → klubben oprettes → brugeren lander på klubbens Overblik. Invitationen ("Inviter dine ølbrødre") står på Klubben, som topbarens "Inviter" fører til (D-163).
* **Join en ølklub:** indtast invitationskode → se klubnavn og antal medlemmer → [ Join klub ].

## 7.3 Invitationer [MVP]

* Hver klub har **én aktiv invitationskode** ad gangen (MVP).
* Koden er 8 tegn fra et alfabet uden forvekslelige tegn (ingen `0/O`, `1/I/L`), fx `K7XM-Q2PA`. Input er case-insensitivt og ignorerer bindestreg og mellemrum.
* Invitationslink: `https://<domæne>/join/K7XMQ2PA`.
* Alle medlemmer kan se og dele linket (fx med en "Del"-knap, der bruger Web Share API på mobil).
* Admins kan **generere en ny kode**, så den gamle holder op med at virke (med confirmation).
* Joiner man en klub, man allerede er medlem af, sendes man bare til klubben. Det er ikke en fejl.
* [SENERE] Udløbsdato og maks. antal brug.

## 7.4 Forlade klub og fjerne medlemmer [MVP]

Når et medlemskab ophører (forladt eller fjernet):

* Medlemskabet slettes.
* **Ratings, øl, events, sange og steder bevares** (klubbens historik).
* Brugerens **stedejerskaber i den klub fjernes** ("Hos Mads" har ikke længere Mads som ejer). Det sker i databasen: ejerskabet peger på medlemskabet (D-096).
* Brugerens **stemmer i åbne afstemninger slettes** (de skal ikke påvirke en fremtidig beslutning). Afgjorte, uafgjorte og annullerede afstemninger beholder stemmerne som historik (D-130).
* **Værtskaber på events, der endnu ikke er startet, fjernes.** Værtskaber på startede og tidligere events bevares som historik (D-098). Ved redigering af et event må en tidligere vært blive stående, men kan ikke vælges igen (E31).
* `lastActiveClubId` nulstilles, hvis den pegede på klubben (E15).
* Ratings fra tidligere medlemmer **tæller fortsat med** i gennemsnittet [BESLUTNING, se §18].
* Historiske data viser stadig brugerens navn/kælenavn, hvis brugeren stadig har en konto. Slettede konti vises som "Tidligere medlem".
* Rækkefølgen er fast (D-102, D-130): først låses klubbens **åbne** afstemninger (`lockOpenPollIds`), så slettes medlemskabet (ejerskaber følger med), derefter de kommende værtskaber, brugerens stemmesedler i netop de låste afstemninger og til sidst `lastActiveClubId`. Nås "alle har stemt" derved, lukkes afstemningen ved næste visning af Overblik, Kalender eller afstemningssiden (eller af cron), ikke af selve udmeldelsen.

**Den sidste admin** kan ikke forlade klubben, før et andet medlem er gjort til admin. Er man det eneste medlem, kan man i stedet slette klubben. UI'et forklarer det og tilbyder genvejen "Gør et medlem til admin" (til medlemslisten). Efter man har forladt klubben, sendes man til sin forside med beskeden "Du har forladt klubben." (D-104).

Admins kan fjerne medlemmer, gøre dem til admin og fjerne admin-rollen fra '⋯'-menuen på medlemslisten (D-102). Man fjerner ikke sig selv (brug "Forlad klubben"), men må fjerne sin egen admin-rolle, når der er mindst to admins. Alle ændringer afgøres under en lås på klubbens række, så to admins aldrig kan efterlade klubben uden admin (E25).

## 7.5 Slette klub [MVP]

Kun admins. Kræver at man **skriver klubbens navn** som confirmation (store/små bogstaver og ekstra mellemrum er ligegyldige; knappen aktiveres, når navnet passer, og serveren tjekker igen under låsen, D-103). Dialogen viser, hvad der forsvinder: "Alt i klubben bliver slettet permanent: 14 events, 37 øl med 102 ratings, 5 steder og 2 afstemninger. Medlemmernes konti bliver ikke slettet." (afstemningerne nævnes kun, når der er nogen). Alt klubindhold slettes: under klubbens lås låses alle klubbens afstemninger, så slettes events, så afstemninger og til sidst klubben (cascade), fordi `events.poll_id` og `poll_options.place_id` er RESTRICT (D-130). Brugerkonti bevares. Bagefter sendes admin'en til sin forside med beskeden "Klubben er slettet.", og de andre medlemmer får 404 på deres næste request (E16).

---

# 8. Navigation og routing

## 8.1 Hovednavigation

| Punkt | Indhold |
|---|---|
| **Overblik** | Næste event, aktive afstemninger, kommende events |
| **Kalender** | Komplet oversigt (måned + liste) |
| **Øl** | Ølkatalog |
| **Sangbog** | Sange |
| **Profil** | Personlige indstillinger, klubbens side, **Feedback (fejl og ønsker)**, log ud |

**Mobil:** bottom navigation med fem punkter (ikon + label), mindst 44 px trykflader:

```text
 ⌂         📅        🍺       🎵       👤
Overblik  Kalender   Øl     Sangbog   Profil
```

Top bar på mobil: **klubnavn med ▾** (klubvælger), og eventuelt en primær handling til højre (fx "+").

**Desktop:** venstre sidebar med klubvælger øverst, punkterne Overblik, Kalender, Øl og Sangbog, og nederst brugerrækken (avatar, navn, email). Brugerrækken er vejen til Profil og er markeret aktiv på profilen, klubbens side og stedernes sider (D-093, D-108). Den viser visningsnavnet (kælenavn ?? navn). Under brugerrækken står **Log ud**, så man kan logge ud uden at gå til Profil (D-159); på mobil ligger Log ud fortsat på Profil.

Klubvælgeren vises kun som dropdown, når brugeren har mere end én klub. Med én klub er klubnavnet bare en overskrift. Dropdownen indeholder også "Opret eller join ny klub".

**Klubbens side** (medlemmer, invitationslink, steder og klubindstillinger) nås via Profil → "Klubben" og via et tryk på klubnavnet.

**Steder** har intet hovedpunkt. De nås via Profil → "Steder", klubbens side (sektionen "Steder" med "N steder") og stednavnet på et event. Fra et steds side fører "Opret event her" til eventformularen med stedet valgt. Et steds side linker tilbage til "Alle steder", og stedernes sider markerer Profil aktiv (D-108).

**Feedback** (§9.9) har heller intet hovedpunkt. Den nås via Profil → "Feedback (fejl og ønsker)" (en egen liste under klub-genvejene), via "Feedback" i footeren "Logget ind som …" på sider uden for en klub og via "Rapportér denne fejl" på fejlsiderne. `/feedback` ligger uden for `/c/[clubId]`, men vises i AppShell for brugerens senest aktive klub (ellers den første), med Profil markeret aktiv. En bruger uden klubber får en enkel ramme med logo, "Tilbage" og "Logget ind som …" (D-147).

## 8.2 Routes

URL-slugs er på engelsk (kodekonsistens). Al UI-tekst er dansk.

```text
/                                   → redirect efter §10.1–10.3
/login  /signup  /forgot-password  /reset-password
/onboarding                         → opret eller join klub
/clubs                              → klubvælger
/join/[code]                        → join via link

/c/[clubId]                         → Overblik
/c/[clubId]/calendar                → Kalender
/c/[clubId]/events/new
/c/[clubId]/events/[eventId]
/c/[clubId]/events/[eventId]/edit
/c/[clubId]/polls/new               → Planlæg ølsmagning (afstemning)
/c/[clubId]/polls/[pollId]          → Stem og se resultater (#stem = stemmesedlen)
/c/[clubId]/polls/[pollId]/edit     (opretter eller admin, kun mens den er åben; datoer og steder indtil første stemme, D-153; ellers ægte 404, D-133)
                                    -- ingen /polls-oversigt: /c/[clubId]/polls giver 404 (D-138)
/c/[clubId]/beers                   → Ølkatalog
/c/[clubId]/beers/new
/c/[clubId]/beers/[beerId]
/c/[clubId]/beers/[beerId]/edit     (opretter eller admin, D-063)
/c/[clubId]/songs                   → Sangbog (?q= søgning)
/c/[clubId]/songs/new               (admin; ellers ægte 404)
/c/[clubId]/songs/import            (admin; ellers ægte 404) → Importér fra PDF (D-156)
/c/[clubId]/songs/[songId]          → Læsevisning
/c/[clubId]/songs/[songId]/edit     (admin; ellers ægte 404)
/c/[clubId]/places                  → Steder (aktive + arkiverede)
/c/[clubId]/places/new
/c/[clubId]/places/[placeId]
/c/[clubId]/places/[placeId]/edit   (alle medlemmer, også arkiverede steder)
/c/[clubId]/club                    → Medlemmer, steder, invitation, farezone
/c/[clubId]/club/edit               (admin; ellers 404) → klubbens navn og beskrivelse
/c/[clubId]/profile                 → Personlige indstillinger (D-023)
/profile                            → videre til /c/[lastActiveClubId]/profile
/feedback                           → Liste over fejl og feature-ønsker (fælles for alle brugere)
/feedback/new                       → Rapportér fejl / foreslå feature
/feedback/[feedbackId]              → Detalje
/feedback/[feedbackId]/edit         → Ret titel/beskrivelse (forfatteren mens Ny, eller app-admin; ellers ægte 404, D-145, D-148)

/api/cron/close-polls               → daglig lukning af afstemninger (Vercel Cron, Bearer CRON_SECRET, §4.8)
```

---

# 9. Features

## 9.1 Overblik [MVP]

**Den vigtigste side.** På få sekunder skal brugeren kunne se:

1. Hvornår næste arrangement er.
2. Hvor det foregår.
3. Hvad planen eller temaet er.
4. Om der er en afstemning, man mangler at stemme i.
5. Hvilke andre events der kommer.

### Layout (prioriteret rækkefølge)

```text
┌────────────────────────────────────────────┐
│  NÆSTE ØLSMAGNING              om 3 dage    │
│                                            │
│        23                                  │
│     OKTOBER                                │
│                                            │
│     Ølsmagning #14                         │
│     Fredag · 18:30                         │
│     📍 Hos Mads                             │
│                                            │
│     Tema: Belgiske øl                      │
│                                            │
│     [ Se event ]                           │
└────────────────────────────────────────────┘

┌─ 🗳 Afstemning: Ølsmagning #15 ────────────┐
│  Du mangler at stemme · frist om 2 dage     │
│  [ Stem nu ]                               │
└────────────────────────────────────────────┘

Kommende arrangementer
  14/11 Juleøl warmup · Hos Jesper
  05/12 …
  19/12 …

[ + Opret event ]   [ 🗳 Planlæg ølsmagning ]

Tidligere ølsmagninger
  18/09 Ølsmagning #12 · Hos Mads
        4 øl · Bedst: Grimbergen Dubbel ★ 4,7
  04/09 Ølsmagning #11 · Hos Mads & Anders
        3 øl · Bedst: Todd the Axe Man ★ 4,5
  21/08 Ølsmagning #10 · Det gamle klubhus
        Ingen øl registreret
  Se alle tidligere →
```

**Tidligere ølsmagninger (D-107):** de 3 nyeste afholdte events, dæmpet, med antal øl og den bedst ratede øl. "Se alle tidligere" fører til Kalenderens liste ved `#tidligere`. Sektionen står efter de kommende events (og under den tomme tilstand) og vises ikke, når klubben ingen historik har. Den har ingen primær knap.

### Hero-kortets tilstande

| Tilstand | Visning |
|---|---|
| Event om mere end 1 dag | "om 3 dage" |
| Event i morgen | "I morgen!" |
| Event i dag (før start) | "I aften! 🍻" (fremhævet) |
| Event i gang (start ≤ nu < slut) | "I gang nu", og genvej til "Tilføj øl" og "Sangbog" |

**Definition [BESLUTNING]:** Et event regnes som *kommende eller igangværende*, indtil `endsAt` er passeret. Har eventet ingen `endsAt`, gælder `startsAt + 6 timer`.

### Aktive afstemninger

Vises som et kort (`PollCard`) pr. afstemning direkte under hero-kortet, stiplet i havneblå som afstemninger overalt (D-137). Er der afstemninger, men ingen kommende events, står kortene øverst og [ Opret event ] [ Planlæg ølsmagning ] under dem. Rækkefølge: dem, brugeren mangler at stemme i → uafgjorte → åbne efter frist → afgjorte.

| Tilstand | Kortet |
|---|---|
| Åben, brugeren mangler | "Du mangler at stemme" (ravfarvet ring) · "Frist om 2 dage · 5 af 8 har stemt" · [ Stem nu ] (messing, til `#stem`) |
| Åben, brugeren har stemt | "Du har stemt ✓" · frist og antal · "Fører lige nu: lør 21/11 · Hos Mads" (eller "Står lige lige nu") · [ Se afstemningen ] |
| Uafgjort, opretter eller admin | "Uafgjort 🤝 – du skal vælge vinderen" · [ Vælg vinder ] (messing) |
| Uafgjort, andre medlemmer | "Uafgjort 🤝 – Mads eller en admin vælger" |
| Afgjort (højst 3 dage efter lukningen, og kun til eventet er slut) | "🎉 Afgjort: lørdag 21. november · Hos Mads" · værter · [ Se event ] · "Se afstemningen" |

Mens et kort venter på brugeren (stemme eller vælge vinder), er hero-kortets [ Se event ] dæmpet, så skærmen kun har én primær handling (D-057). Overblik lukker afstemninger, der er klar til det, før siden læser data (lazy close, §9.7.5), så et event, der lige er blevet til, står i hero-kortet med det samme.

### Empty states

* **Ingen events og ingen afstemninger:** "Ingen kommende ølsmagninger endnu 🍺" med [ Opret event ] og [ Planlæg ølsmagning ]. Har klubben historik, står "Tidligere ølsmagninger" under den tomme tilstand.

---

## 9.2 Events [MVP]

### Felter

| Felt | Påkrævet | Note |
|---|:-:|---|
| Titel | ✅ | Forslag udfyldes automatisk: "Ølsmagning #N" (N = antal tidligere events + 1). Kan overskrives. |
| Dato | ✅ | |
| Starttid | ✅ | Standard 18:30. |
| Sluttid | – | Valgfri. Bruges til "I gang nu". |
| Sted | ✅ | Vælges fra klubbens aktive steder. "＋ Nyt sted" opretter et sted inline uden at forlade formularen (D-099). |
| Tema | – | Kort tekst, fx "Belgiske øl". Vises fremhævet på Overblik. |
| Beskrivelse / plan | – | Fritekst med linjeskift. Anbefales, men er ikke påkrævet [BESLUTNING]. |
| Værter | – | Udfyldes automatisk med stedets ejere (eller opretteren, hvis stedet ikke har ejere). Kan justeres (D-098). |

Rækkefølge i formularen: Titel · Dato/Starttid/Sluttid · Sted · Værter · Tema · Beskrivelse/plan.

**Sted (D-099, D-111):** et radio-kort pr. aktivt sted, senest brugte først. Kortets navn er stedets navn; linjen under viser adresse og ejere ("Søndergade 12, 8381 Tilst · Ejer: Mads"). Har klubben mere end 6 steder, vises de 5 første, og resten ligger under "Vis alle N steder". Det sidste kort er "＋ Nyt sted", der folder felterne "Navn på stedet", "Adresse (valgfri)" og "Det er mit sted" ud (med CSS, så det virker før JavaScript). Stedet oprettes i samme transaction som eventet. Har klubben allerede et aktivt sted med samme navn (samme regel som §9.4), genbruges det, og formularen siger det med det samme: "«Hos Mads» findes allerede." [ Vælg det ] (E29).

* Forvalg: ingen steder → "＋ Nyt sted" er valgt og åbent ("Klubben har ingen steder endnu. Skriv, hvor I mødes."). Præcis ét sted → det er valgt. `?placeId=` (fra stedets "Opret event her") → det sted er valgt, hvis det er et aktivt sted i klubben. Ellers er intet valgt: et forkert hus er værre end ét tryk.
* Ved redigering er eventets sted valgt, også hvis det er arkiveret ("Hos Mads (arkiveret)", E30).

**Værter (D-098, D-112):** et afkrydsningskort pr. medlem (avatar, visningsnavn, "(dig)"). Uberørt følger valget stedet: stedets ejere, der er medlemmer, ellers opretteren. En hjælpetekst siger, hvad der sker ("Udfyldt med stedets ejere.", "Stedet har ingen ejere, så du er vært.", "Vælg et sted, så foreslår vi værter."). Når man selv har krydset af, står valget, til man trykker "Brug stedets ejere". Krydser man ingen af, bruger serveren standarden. Ved redigering er en vært, der har forladt klubben, et afkrydset kort "(tidligere medlem)", der kan fravælges, men ikke vælges igen (E31). Højst 20 værter.

Validering: titel 1–100 tegn, dato/tid gyldig, et sted er valgt ("Vælg et sted, eller opret et nyt."), stedet tilhører klubben og er aktivt (på redigering må et arkiveret nuværende sted blive), et nyt sted har et navn ("Giv stedet et navn.", 1–120 tegn) og højst 200 tegn adresse, værter er nuværende medlemmer af klubben (eksisterende værter må blive). Et sted fra en anden klub giver samme besked som et slettet sted ("Stedet findes ikke længere. Vælg et andet."). Et event må gerne oprettes i fortiden (til at registrere gamle smagninger).

### Event detail

Skal føles som en invitation, ikke en formular:

```text
            ⚓
     ØLSMAGNING #14

   Fredag 23. oktober
         18:30

   📍 Hos Mads
      Søndergade 12, Tilst   [ Åbn i kort ]

   Tema: Belgiske øl

   ─────── Planen ───────
   Vi starter med en øl fra Tyskland,
   derefter blindsmagning og pizza.

   Værter: Mads
   Oprettet af Kaptajnen

   ─────── Øl smagt til dette event ───────
   🍺 Grimbergen Dubbel   ★ 4,7
   🍺 Westmalle Tripel    ★ 4,5
   [ + Tilføj øl ]
```

* Stedets navn linker til stedets side og har et "Arkiveret"-mærke, når stedet er arkiveret. Adressen står på linjen under.
* "Åbn i kort" er en Google Maps-søgning på stedets **adresse** og vises kun, når stedet har en adresse. Ellers står der et lille "Tilføj adresse", der fører til stedets redigering (D-101).
* "Vært: Mads" / "Værter: Mads og Anders" med avatarer (visningsnavne), derefter "Oprettet af …". Har alle værter forladt klubben før eventet, vises ingen værtslinje.
* Listen "Øl smagt til dette event" er billig at lave (øl har `eventId`) og meget værdifuld under smagningen. Den er med i MVP. "+ Tilføj øl" udfylder eventet på forhånd.
* Stammer eventet fra en afstemning, vises en lille note: "Valgt ved afstemning 🗳" med link.

### Redigering og sletning

* Opretter, værter og admins kan redigere og slette (D-098). Andre får beskeden "Kun opretteren, værterne og klubbens admins kan rette eventet." (eller "… slette eventet."), og redigeringssiden giver dem 404.
* Sletning kræver confirmation:

```text
Er du sikker?
"Ølsmagning #14" bliver slettet permanent.
Øl, der er knyttet til eventet, bliver i kataloget, men mister koblingen.

[ Annuller ]   [ Slet event ]
```

* Når et event slettes, sættes `Beer.eventId` til `null`. Øllene og deres ratings bevares.

---

## 9.3 Kalender [MVP]

Overblikket viser de næste events. Kalenderen er den **komplette** oversigt, både fremtid og fortid.

### Visninger

* **Listevisning (standard på mobil):** grupperet pr. måned, kommende øverst og sektionen **"Tidligere ølsmagninger"** (`#tidligere`) nedenunder (D-107): de 12 nyeste afholdte events, grupperet pr. måned med den nyeste først, dæmpede og med antal øl og den bedst ratede øl. Derefter "Vis alle N tidligere" (`?past=all`). Månedsoverskrifterne i historikken har deres egne tilgængelige navne ("Tidligere ølsmagninger Oktober 2026").
* **Månedsvisning (standard på desktop):** klassisk månedsgitter, hvor events vises som tydelige chips med titel og tid. Ingen ulæseligt små bokse. På mobil viser månedsgitteret prikker på datoer, og et tryk på en dato viser dagens events nedenunder.

```text
OKTOBER 2026

 23  Ølsmagning #14
 FRE Hos Mads · 18:30

 31  Halloween-smagning
 LØR Hos Jesper · 19:00

NOVEMBER 2026

 14  ┊ Ølsmagning #15 (afstemning)
 LØR ┊ Mulig dato · stem inden 10/11
```

### Bekræftet vs. afstemning

| Type | Visuel stil |
|---|---|
| **Bekræftet event** | Fyldt kort, grøn accent, fuld opacitet |
| **Afstemning** | Stiplet kant, 🗳-ikon, label "Mulig dato". Hver datomulighed vises på sin egen dato og linker til afstemningen. |

Når afstemningen er afsluttet, forsvinder de stiplede muligheder, og det oprettede event vises som et almindeligt event.

**Bygget (runde 4, D-137):** åbne og uafgjorte afstemningers datoer vises. I listen er det `PollOptionCard` ("Ølsmagning #15 (afstemning)", "🗳 Mulig dato · stem inden 10/11" eller "venter på afgørelse", og "Du kan ✓", når brugeren har sat kryds ved datoen). Desktop-gitteret har `PollOptionChip` (stiplet chip med det fulde tilgængelige navn "Mulig dato: …"). Mobilens gitter viser en hul havneblå ring som prik, dagens knap læses som "…, 1 event, 1 mulig dato", og dagspanelet viser begge slags. Fra `md` har sidehovedet [ Planlæg ølsmagning ] og [ Opret event ]. Kalenderen lukker også afstemninger, der er klar (lazy close), før den læser data.

[SENERE] Ugevisning og eksport til egen kalender (.ics).

---

## 9.4 Steder [MVP]

### Felter

* **Navn** (påkrævet, 1–120 tegn), fx "Hos Jesper". Unikt blandt klubbens **aktive** steder uden hensyn til store/små bogstaver og mellemrum (samme regel som øl-dubletter, D-086). En dublet afvises med "Der findes allerede et sted, der hedder «Hos Jesper»." og et link til stedet (D-095).
* **Adresse / lokation** (valgfri, højst 200 tegn), fx "Søndergade 12, 8381 Tilst". "Åbn i kort" søger på den (D-101).
* **Beskrivelse** (valgfri, højst 1000 tegn, linjeskift bevares), fx "Ring på bagdøren"
* **Ejere** (0..n medlemmer)

### Sider

* **Steder** (`/places`): aktive steder som kort (navn, adresse, "Ejer: Mads" / "Ejere: Mads og Anders" / "Ingen ejere", antal ølsmagninger eller "Ikke brugt endnu", mærket "Dit sted"), de arkiverede foldet ind under "Arkiverede steder (N)". Primær handling: "Nyt sted". Tom tilstand: "Ingen steder endnu 📍".
* **Et sted** (`/places/[placeId]`): adresse med "Åbn i kort" (ellers "Tilføj adresse"), beskrivelse, ejerne, "Ølsmagninger her (N)" (nyeste først, de afholdte dæmpet) og "Opret event her" som primær handling (eventformularen med stedet valgt). Rediger og én fjern-knap nederst.

### Ejerskab

| Antal ejere | Eksempel | Betydning |
|---|---|---|
| 0 | "Den lokale bar" | Offentligt/neutralt sted |
| 1 | "Hos Jesper" | Jesper bliver vært, hvis stedet vælges |
| Flere | "Hos Mads & Anders" | Begge bliver værter |

* Alle medlemmer kan **sætte sig selv på** som ejer og **fjerne sig selv**. Det er en enkelt knap på stedets side: [ Det er mit sted ] / [ Fjern mig som ejer ]. Etiketten siger, hvad knappen gør (ingen `aria-pressed`), og en statuslinje bekræfter ændringen. Knappen opdaterer med det samme og ruller tilbage med en fejlbesked, hvis serveren afviser (D-115). Ingen confirmation.
* "Det er mit sted" kan også krydses af, når stedet oprettes (både på "Nyt sted" og inline i eventformularen).
* Admins kan fjerne **andre** ejere (et X ved hver ejer, med confirmation: "Fjern Mads som ejer af «Hos Mads»?" / "Mads bliver ikke længere foreslået som vært her.").
* Ejerne bliver automatisk foreslået som værter, når stedet bruges til en smagning. Allerede oprettede events ændres ikke.
* Alle medlemmer kan redigere navn, adresse og beskrivelse, også på arkiverede steder. Det er en bevidst demokratisk model for små klubber.
* [SENERE] Historik over hvem der ændrede hvad, hvis der opstår behov.

### Sletning = arkivering [BESLUTNING]

Steder slettes aldrig hårdt, når de er i brug. De **arkiveres** (D-100):

* Stedets side har **én** fjern-knap, der hedder det, der vil ske: "Slet sted" for et sted, der aldrig er brugt ("Stedet er ikke brugt til nogen ølsmagninger, så det bliver slettet helt."), "Arkivér sted" for et brugt sted ("Stedet er brugt til N ølsmagninger, så det bliver ikke slettet. …"). Serveren afgør det igen under en rækkelås, og beskeden bagefter følger det, der faktisk skete.
* Arkivere: stedejere og admins. Slette et ubrugt sted: stedejere, admins og den, der oprettede det (oprydning efter en tastefejl).
* Arkiverede steder vises ikke i stedvælgere (undtagen eventets eget sted ved redigering, E30).
* Events, der bruger stedet, viser det stadig (historik bevares, og der er ingen døde referencer).
* Et arkiveret sted viser et banner "Arkiveret · vises ikke, når I vælger sted" med [ Gendan sted ] for stedejere og admins. Har et aktivt sted fået samme navn imens, afvises gendannelsen med "Der findes allerede et aktivt sted, der hedder «X»." og et link.
* Et sted, der er valgmulighed i en **åben eller uafgjort** afstemning, kan hverken arkiveres eller slettes (E5, D-132). Stedets side siger: "Stedet er med i afstemningen «Ølsmagning #15», så det kan ikke arkiveres, før den er afsluttet eller annulleret." med [ Se afstemningen ], og fjern-knappen vises ikke. Serveren tjekker det igen under stedets lås.
* Et sted, der har været valgmulighed i en afstemning, men aldrig er brugt til et event, **arkiveres** i stedet for at blive slettet (afstemningen viser det stadig): "Stedet har været med i en afstemning, så det bliver arkiveret i stedet for slettet. Det forsvinder fra listen, når I vælger sted, men afstemningen viser det stadig."
* Et sted, der aldrig er brugt, må gerne slettes helt.

---

## 9.5 Ølkatalog og ratings [MVP]

Klubbens historik over øl, man har drukket. En af de centrale features.

### En øl

| Felt | Påkrævet | Note |
|---|:-:|---|
| Navn | ✅ | 1–120 tegn |
| Alkoholprocent | ✅ | 0,0–99,9, én decimal. Input accepterer både "5,2" og "5.2". |
| Event | – | Valgfrit. Kun events i samme klub. |

[SENERE] Bryggeri, øltype, land og noter. Datamodellen skal kunne udvides uden at bryde noget.

**Billede [MVP] (D-158):** "Tilføj øl" og "Rediger øl" har feltet "Billede (valgfrit)" ([Tag eller vælg billede], på telefonen også kameraet). Et stort billede gøres mindre i browseren før upload; serveren drejer det efter EXIF, gør det højst 1200 × 1200 px, gemmer det som WebP uden metadata (ingen GPS) i `beer_images` og afviser andet end JPG, PNG, WebP, AVIF og GIF ("Billedet kunne ikke læses. Brug et JPG- eller PNG-billede.", højst 4 MB). Billedet vises på øllens side og som miniature på kortet i kataloget og på eventsiden (ellers 🍺). Ved redigering kan det skiftes eller fjernes ([Fjern billede]). Det serveres kun til klubbens medlemmer fra `/c/[clubId]/beers/[beerId]/image?v=<version>`; alle andre får 404.

**Dublet-advarsel:** Findes der allerede en øl med samme navn i klubben (uden hensyn til store/små bogstaver og mellemrum), vises "Den her har I vist smagt før 👀" med link til den eksisterende. Man kan stadig oprette den.

### Rating

* Individuel: hvert medlem har **højst én rating pr. øl** (unik constraint).
* Skala **1–5 med halve point** (1, 1,5, 2 … 5).
* **Lagring [BESLUTNING]:** gemmes som heltal i halve point (`2..10`) for at undgå floating point-problemer. UI viser `value / 2`.
* Brugeren kan rate første gang, ændre sin rating og fjerne sin rating.
* **Klubbens rating** = gennemsnittet af alle ratings, beregnet ved læsning og vist med én decimal ("4,3"). Den gemmes aldrig.

### Rating-komponent (`<BeerRating />`)

* Fem store stjerner. Tryk på venstre halvdel giver halv stjerne, højre halvdel hel stjerne.
* Gemmes med det samme ved tryk (optimistisk UI og en lille "Gemt ✓"). Der er ingen separat gem-knap. Det er hurtigt under en smagning.
* "Fjern min rating" er et diskret link under stjernerne.
* Tilgængelighed: implementeret som radiogruppe med 9 værdier og piletaststyring samt `aria-label` som "4,5 ud af 5".

### Øl-detail

```text
Grimbergen Dubbel
6,5 %

Klubbens rating
★★★★½  4,7  ·  12 ratings

Din rating
★★★★★  (tryk for at ændre)

Smagt til
Ølsmagning #12 · 14. sep 2026

Ratings
Kaptajnen ★ 5   ·   Mads ★ 4,5   ·   …
```

Det er en lille klub, så det er socialt og sjovt at se hinandens ratings.

### Oversigt

```text
Ølkatalog                      [ + Tilføj øl ]

[ 🔎 Søg øl… ]
Sorter: [ Bedste rating ▼ ]   Event: [ Alle ▼ ]

🍺 Grimbergen Dubbel        ★ 4,7 (12)
   6,5 % · Ølsmagning #12          Din: ★ 5

🍺 Carlsberg Hvidtøl        ★ 4,3 (9)
   5,2 %                           Din: –
```

* **Søgning:** på navn, uden hensyn til store/små bogstaver og med korrekt håndtering af æ, ø og å.
* **Sortering:** bedste rating, flest ratings, nyeste, alkohol (høj→lav og lav→høj), navn (A–Å). Øl uden ratings ligger sidst ved rating-sortering.
* **Filter:** event.
* Hvert kort viser **din egen rating**, så man hurtigt kan se, hvad man mangler at rate.

### Empty state

"Kataloget er tomt. Hvad drak I sidst? 🍺" og [ Tilføj øl ].

---

## 9.6 Sangbog [MVP]

Digital udgave af klubbens eksisterende sangbog. Den primære funktion er at **finde og læse** sange, ofte på telefonen midt i en smagning. Sangene vises **i appen** (ikke som download), kan søges og står altid alfabetisk (Jespers krav, D-118).

### Felter

* **Titel** (påkrævet, 1–120 tegn, unik i klubben uden forskel på store/små bogstaver og mellemrum; en dublet giver feltfejlen med et link til sangen, der har titlen)
* **Kunstner** (valgfri, 1–120)
* **Melodi** (valgfri, 1–120), vises som "Mel.: …"
* **Tekst og akkorder** (påkrævet, højst 20.000 tegn) i sangtekstformatet nedenfor

Nummer er fjernet (sangbogen har ingen numre, Q5). Akkorder er med fra start (var [SENERE]). [SENERE] Kategori, forfatter og favoritter.

### Sangtekstformatet (D-122)

* En tom linje = nyt vers.
* `[Omkvæd]`, `[Vers 2]` osv. på en linje for sig er etiketter. Et kendt ord alene (fx `Chorus`, `verse 2:`, `SOLO`) er også en etiket. Etiketter vises på dansk: Verse → Vers, Chorus/Refrain → Omkvæd, Bridge → Bro, Interlude → Mellemspil, Outtro → Outro, SOLO → Solo.
* Akkorder står på en linje for sig over teksten. Enkelte mellemrum = en række (fx `G C D x2`), ekstra mellemrum placerer akkorden over et bestemt ord.
* `capo: 2` (og `tuning:`, `stemning:`, `tempo:`, `bpm:`) på en linje for sig er en note, der kun vises med akkorder.
* En linje, der begynder med `\`, er altid tekst (til en tekstlinje, der ellers ville ligne en akkord eller en etiket).
* Teksten gemmes, som den er skrevet (renset for tabulatorer, usynlige tegn og dobbelte tomme linjer), og klassificeres først ved visning i `src/server/domain/songs/song-text.ts`. `body` må aldrig søges eller vises råt.

### Oversigt

* Altid alfabetisk i dansk rækkefølge (Æ, Ø, Å sidst; "Aa" under Å; tal og tegn under #) med bogstavoverskrifter. Undertitlen er "<n> sange fra A til Å".
* Et klæbende søgefelt under top-baren (øverst fra `md`) med et **A–Å**-gitter (6 × 5 felter, # først, Æ Ø Å sidst, tomme bogstaver dæmpet).
* Søgningen sker med det samme i titel, kunstner, melodi og tekst. Træf i titel, kunstner eller melodi kommer først, så "Fundet i teksten" med den linje, der matchede, fremhævet. Tekst matcher kun fra starten af et ord.
* Finder den intet, prøver den igen uden forskel på æ/ø/å og siger det: "Ingen præcise træf. Her er sange, hvis man ser bort fra æ, ø og å."
* Søgningen står i URL'en (`?q=`), og et dybt link viser træffene allerede fra serveren. "‹ Sangbog" i læsevisningen vender tilbage til søgningen.
* Tom sangbog: "Sangbogen er tom endnu 🎵" (admins får [Tilføj sang]). Ingen træf: "Ingen sange matcher „…“" og "Prøv et enkelt ord fra titlen eller en linje, du kan huske."

### Læsevisning

* Stor, læsbar typografi og generøs linjeafstand. Titlen er sidens h1, med kunstner og "Mel.: …" under.
* **Tekst | Akkorder** (Tekst er standard; knappen vises kun, når sangen har akkorder). Akkordvisningen viser "Akkorder i sangen", noter, akkordrækker og akkorder over ordene.
* **Skriftstørrelse** i 7 trin (16–32 px, standard 20 px). Visning og størrelse huskes pr. enhed (`localStorage`) og sættes på `<html>` før første visning (D-124). På mobil sidder knapperne i top-baren, fra `md` i værktøjslinjen.
* **Hold skærmen tændt** mens sangen er åben (Screen Wake Lock API, hvor browseren understøtter det; ingen UI).
* **Forrige/Næste** gennem hele bogen i alfabetisk rækkefølge (ikke søgningen) uden at starte forfra, plus ← og → på desktop (D-125).
* Admins har [Rediger sang] og [Slet sang] nederst.

### Administration

Kun admins opretter, retter og sletter sange (medlemmer får ægte 404 på `/songs/new` og `/edit`). Formularen har et tekstfelt med fast bredde (monospace, ingen ombrydning), en formatguide ("Sådan skriver du vers, akkorder og omkvæd") og en forhåndsvisning med akkorder. Sletning sker fra sangens side med bekræftelse: "Slet «Titel»?", "Sangen forsvinder fra sangbogen for alle i klubben. Det kan ikke fortrydes.", [Behold den].

### Importér fra PDF i appen [MVP] (D-156)

Admins kan lægge sange ind fra PDF'er direkte i appen, ved siden af "Tilføj sang". Indgange: "Importér fra PDF" i den tomme sangbog og i sangbogens sidehoved. Siden er `/c/[clubId]/songs/import` (medlemmer får ægte 404).

* **Vælg PDF'er:** én sang pr. fil, mange på én gang (filvælger eller træk-og-slip), højst 4 MB og 30 sider pr. fil. Hver fil sendes for sig til serveren (tre ad gangen, "Læser 12 af 59 PDF'er …"). PDF'en gemmes aldrig, kun teksten (D-120).
* **To slags PDF'er:** En ChordBank-udskrift (kun ChordBanks skrifter og en titel) læses præcis som CLI-importen: akkorder over ordene, etiketter, vers og samme titelregel ("Med akkorder"). Alle andre PDF'er bliver til ren tekst ("Ren tekst"): linjer oppefra og ned, nyt vers ved et stort lodret mellemrum, akkordlinjer beholder deres kolonner over linjen nedenunder, en større første linje bliver titel (ellers filnavnet), sidetal fjernes. En PDF uden tekst (scannet) får beskeden "PDF'en har ingen tekst, som kan læses. Er den scannet? Så må sangen skrives ind."
* **Gennemsyn:** en liste med titel, kunstner, slags, filnavn og afkrydsning. Nye sange er valgt; en fil, der er importeret før ("Filen er importeret før."), eller en titel, klubben allerede har, er fravalgt med et link til den eksisterende sang. [Vis og ret] åbner sangformularens felter (titel, kunstner, melodi, tekst med forhåndsvisning og formatguide) og samme Zod-schema; en sang med fejl kan ikke vælges. To valgte sange med samme titel blokerer [Importér].
* **Importér:** de valgte sange sendes i portioner á 25 og valideres igen på serveren. Intet overskrives og intet slettes: en sang springes over, hvis klubben har filen, titlen er taget, eller en tidligere sang i samme import har titlen eller filen. Går alt igennem, lander admin i sangbogen med "Sangene er importeret 🎵"; ellers vises "N sange er importeret 🎵" og hvad der blev sprunget over og hvorfor.
* **Herkomst:** `sourceKey` er `chordbank:<filnavn>` (samme nøgle som CLI-importen, så de genkender hinandens sange) eller `pdf:<filnavn>`, og `importHash` er hashen af sangen, som den blev læst. Retter admin sangen i gennemsynet, passer hashen ikke, og en senere CLI-import behandler den som "REDIGERET I APPEN".
* Kræver JavaScript (en upload i flere trin); "Tilføj sang" virker stadig uden.

### Import af den eksisterende sangbog [MVP] (D-126)

Sangbogen er 59 ChordBank-udskrifter (én PDF pr. sang) i `data/sangbog/visne-viser/` (git-ignoreret, i `.vercelignore`). PDF'erne gemmes og serveres aldrig af appen; kun teksten kommer i databasen (D-120). Importen er `npm run songbook:import` (`scripts/import-songbook.ts`, kræver `pdftohtml` fra poppler). ChordBank-parseren ligger i `src/server/domain/songs/chordbank/` og deles med importen i appen (D-156):

* **Kun læsning** (uden `--user`): læser PDF'erne med `pdftohtml -xml`, kortlægger skrifttyper strengt (ukendt skrift = FEJL), laver vers, etiketter og akkordplacering, kører altid en round trip (den gemte tekst læses igen med `parseSong`) og validerer mod `songFieldsSchema`. Viser titler, flag og "Kræver en beslutning", men ingen sangtekst.
* **Tør kørsel** (`--user <email> --club <id>`): planen med statusserne NY, NY?, UÆNDRET, OPDATERES, REDIGERET I APPEN, TITEL OPTAGET, FEJL og FORÆLDRELØS. `--user` alene viser de klubber, man er admin i.
* **`--apply`**: skriver hele planen i én transaction. Nøglen er kildefilen (`sourceKey`), og `importHash` viser, om sangen er rettet i appen; den overskrives aldrig (kun med `--overwrite-edited --only`). En ny fil i en klub, der har importeret før, kræver `--include-new`. En ny kørsel uden ændringer giver UÆNDRET for alle.
* Rettelser (titler, kunstnere, tekst-erstatninger) står i `data/sangbog/overrides.json` (git-ignoreret), så udvikling og produktion får samme tekst.
* Kører lokalt. En database, der ikke er lokal, kræver `--remote`, og `--apply` mod den kræver, at klubbens navn tastes i en terminal (TTY). Produktion køres kun af Jesper (README "Importér sangbogen").

---

## 9.7 Afstemninger (planlæg ølsmagning) [MVP]

Den mest avancerede feature. Formålet er at planlægge en fremtidig ølsmagning ved at stemme om **dato** og **sted**.

### 9.7.1 Oprettelse

```text
Planlæg ølsmagning

Titel             [ Ølsmagning #15 ]
Beskrivelse       [ … ]
Tema (valgfrit)   [ … ]

Hvornår?  (mindst én)
  [ 14.11.2026 ] Lørdag 14. november   ✕
  [ 21.11.2026 ] Lørdag 21. november   ✕
  [ 28.11.2026 ] Lørdag 28. november   ✕
  [ + Tilføj dato ]
  Starttid for alle datoer [ 18:30 ]

Hvor?  (mindst ét)
  ☑ Hos Jesper
  ☑ Hos Mads
  ☑ Den lokale bar
  [ + Nyt sted ]

Afstemningsfrist  [ 10/11/2026  20:00 ]

[ Opret afstemning ]
```

Regler:

* Hver kategori kræver **mindst én** valgmulighed, højst 10 datoer og 10 steder (D-134).
* Har en kategori **kun én** valgmulighed, er den på forhånd fastlagt, og der stemmes ikke om den. Så kan man fx stemme kun om datoen ("vi er hos Mads, men hvornår?").
* **Mindst én kategori skal have to eller flere valgmuligheder** (D-134). Ligger alt fast, afvises formularen med "Tilføj mindst to datoer eller to steder, så der er noget at stemme om. Ligger alt fast, så opret et event i stedet." og et link til "Opret event" med datoen og stedet udfyldt.
* Datomuligheder er dato + starttid (én fælles starttid for alle, standard 18:30).
* Datoerne og fristen skal ligge i fremtiden, og fristen **før den tidligste datomulighed**. Formularen tjekker formen; serveren tjekker tiderne med sit eget "nu", både før og under låsen (D-134).
* Ingen dublerede datoer eller steder (dubletter fjernes).

**Forslag (D-135):** titlen foreslås som "Ølsmagning #N" (åbne og uafgjorte afstemningers titler tæller med, D-137). Tre datoer foreslås på klubbens mest almindelige ugedag blandt de seneste 12 events (ellers lørdag), den første mindst 7 dage frem; "+ Tilføj dato" lægger en uge til den sidste. Fristen følger "2 dage før første dato kl. 20:00" (ellers dagen før kl. 20:00, ellers 3 timer før start), indtil man selv retter den. Stederne er afkrydsningskort (en checkbox-variant af stedvælgerens kort, TG-054); "Vis alle N steder" over seks steder. "＋ Nyt sted" opretter stedet sammen med afstemningen (samme dublet-regel som eventformularen, E29). Uden steder er "＋ Nyt sted" krydset af; med ét sted er det krydset af. En linje opsummerer: "Klubben stemmer om 3 datoer og 2 steder · frist …".

### 9.7.2 Afstemningsregler

* Alle nuværende medlemmer kan stemme.
* **Hvornår? – kryds ved alle datoer, der passer** (Doodle-stil, *approval voting*) [BESLUTNING]. Man kan sætte kryds ved én eller flere datoer. Kan man ingen af dem, sætter man kryds ved **"Ingen af datoerne passer mig"**. Det tæller som en afgivet stemme, men giver ingen point til nogen dato.
* **Hvor? – én stemme.** Man vælger præcis ét sted.
* En **stemmeseddel** (`PollBallot`) er *komplet*, når hver kategori med mere end én valgmulighed er udfyldt: mindst én dato eller "ingen passer" plus ét sted.
* Kun **komplette** stemmesedler gemmes, så "har stemt" = der findes en stemmeseddel (D-134). Kryds i en fastlagt kategori ignoreres.
* Man kan ændre sin stemme indtil fristen. Det gamle sæt kryds erstattes helt af det nye.
* Resultaterne er synlige og opdateres løbende.
* Serveren afviser stemmer, når afstemningen ikke længere er åben, uanset hvad UI'et viser. Rammer en stemme en afstemning, hvis frist er gået, lukker serveren den og svarer "Afstemningen er lukket 🔒" (E6).
* **Datoer og steder kan rettes, indtil den første stemme er afgivet (D-153).** Derefter kun titel, tema, beskrivelse og en senere frist (E24). Er datoerne eller stederne forkerte, efter nogen har stemt, annullerer man og starter en ny. Opretteren og admins retter på `/polls/[pollId]/edit`, mens afstemningen er åben. Uden stemmer gælder oprettelsens regler (mindst to valgmuligheder i én kategori, højst 10 af hver, ingen datoer i fortiden, fristen i fremtiden og før den første dato), så fristen må også rykkes tidligere; fra første stemme kan den kun rykkes senere. ~~Valgmuligheder ændres aldrig efter oprettelsen (D-133)~~ erstattet 2026-10-18 af D-153.

### 9.7.3 Stemme-UI

```text
Ølsmagning #15
Frist om 3 dage, 4 timer

HVORNÅR?  (sæt kryds ved alle, du kan)
  ☐ Lørdag 14/11   ███████       3   🙂🙂🙂
  ☑ Lørdag 21/11   ███████████   5   🙂🙂🙂🙂🙂
  ☑ Lørdag 28/11   ███           2   🙂🙂
  ☐ Ingen af datoerne passer mig      🙂

HVOR?  (vælg ét)
  ○ Hos Jesper     ███████       3   🙂🙂🙂
  ● Hos Mads       ███████████   5   🙂🙂🙂🙂🙂
  ○ Den lokale bar ██            1   🙂

  6 af 8 har stemt · Mangler: Anders, Bo

[ Gem min stemme ]
```

**Fuldt åbne stemmer [BESLUTNING]:** Ved hver valgmulighed vises avatarer/navne på dem, der har stemt på den (tryk for at se den fulde liste). Det står også, hvem der mangler at stemme. Det er en lille klub, og det gør afstemningen social. UI'et skriver tydeligt, at stemmerne er synlige for alle i klubben.

Efter man har stemt:

```text
Skål! Din stemme er gemt ✓
Du kan ændre den indtil tirsdag 10. november kl. 20:00
```

**Bygget (D-136):** datoerne er native checkbokse, hvis tilgængelige navn er "lørdag 14. november kl. 18:30" og beskrivelse "3 kan: Mads, Anders og dig". «Ingen af datoerne passer mig» og datoerne udelukker hinanden. Stedets meta-linje er "Søndergade 12 · Mads bliver vært". Krydsene flytter tallene, søjlerne og "Fører"-mærket med det samme som en **forhåndsvisning** (egen avatar med stiplet ring, "Ikke gemt endnu"), men intet gemmes før [ Gem min stemme ] / [ Opdatér min stemme ], der sender videre med toasten "Skål! Din stemme er gemt ✓" (og "… Alle har stemt, og eventet er oprettet 🎉" eller "… Alle har stemt – men der er uafgjort 🤝", når den sidste stemme lukker afstemningen). Navnene står ved avatarerne op til fire stemmer, derover under "Se alle (N)". Under stemmesedlen: én søjle pr. medlem, "6 af 8 har stemt · Mangler: Anders, Bo og dig" (eller "Alle har stemt 🎉"). Siden opdaterer sig selv hvert 30. sekund, mens afstemningen er åben og siden er synlig, men aldrig mens stemmesedlen har ugemte kryds. Efter fristen og når den er lukket, vises de samme rækker som resultat med "🏆 Vinder" og (uafgjort) "🤝 Står lige".

### 9.7.4 Status og livscyklus

```text
            ┌──────────── annuller ─────────────┐
            │                                   ▼
  OPEN ──(luk)──► tally ──► entydig vinder ──► CLOSED  (event oprettet)
                     │
                     └──► uafgjort ──► AWAITING_DECISION ──(vælg vinder)──► CLOSED
                                               │
                                               └── annuller ──► CANCELLED
```

| Status | Betydning |
|---|---|
| `OPEN` | Man kan stemme |
| `AWAITING_DECISION` | Lukket, men mindst én kategori er uafgjort. Opretter/admin skal vælge. |
| `CLOSED` | Afsluttet. Et event er oprettet. |
| `CANCELLED` | Annulleret af opretter/admin. Intet event oprettet. Stemmerne bliver stående, og siden viser "Annulleret af Mads lørdag 7. november. Der blev ikke oprettet et event." |

Hvem og hvornår gemmes (D-129): `closeReason` og `closedAt`, når afstemningen holder op med at tage imod stemmer (også ved uafgjort, og de bevares ved en senere annullering), `closedBy` kun ved manuel lukning, og `cancelledAt`/`cancelledBy` ved annullering. CHECK-constraints holder kombinationerne gyldige.

### 9.7.5 Hvornår lukkes afstemningen?

1. **Deadline nået.** `now ≥ deadline`.
2. **Alle har stemt.** Alle *nuværende* medlemmer har en komplet stemmeseddel (§9.7.2).
3. **Manuelt.** Opretter eller admin trykker [ Afslut afstemning nu ] og bekræfter.

**Teknisk udløsning [BESLUTNING]:** Der er ingen afhængighed af en præcis baggrundsjob-timing. Alle udløsere bruger den samme funktion (`closeLockedPollTx`, D-131).

* Efter hver stemme tjekkes "alle har stemt" i **samme transaction** som stemmen, så den sidste stemme, lukningen og eventet gemmes samlet.
* Ved hver visning af Overblik, Kalender og afstemningssiden lukkes afstemninger, hvis frist er gået, **eller** hvor alle nuværende medlemmer har stemt (*lazy close*; det sidste kan blive sandt, når nogen forlader klubben). Det sker aldrig i et layout, og en fejl logges uden at vælte siden.
* Manuel lukning af en åben afstemning, hvis frist allerede er gået, gemmes som `DEADLINE` (fristen var det, der lukkede den).
* Et **dagligt** Vercel Cron-job (kl. 04:00 UTC, §4.8) lukker udløbne afstemninger og afstemninger, hvor alle har stemt, som sikkerhedsnet, så eventet også dukker op, selvom ingen har åbnet appen. På Vercel Hobby kan cron højst køre én gang i døgnet (§4.8). Derfor er lazy close den primære mekanisme. Bliver præcis lukning uden besøg vigtig, kan Pro-planen eller en ekstern scheduler (fx Upstash QStash) bruges.
* Lukning er **idempotent**: den sker i en transaction med betinget opdatering (`UPDATE … WHERE status = 'OPEN'`), og `Event.pollId` er unik. Samtidige forsøg kan derfor aldrig oprette to events.

### 9.7.6 Optælling og vinder

For hver kategori:

* Kun én valgmulighed: den vinder.
* **Dato:** den dato, som **flest kan** (flest kryds), vinder. "Ingen passer"-kryds tæller ikke for nogen dato.
* **Sted:** stedet med flest stemmer vinder.
* **Uafgjort** (flere har samme topscore, også hvis der er 0 stemmer i alt): ingen automatisk eller tilfældig vinder. Afstemningen går i `AWAITING_DECISION`.

```text
Der er uafgjort om stedet 🤝

  Hos Mads     4
  Hos Jesper   4

[ Vælg vinder ]   (kun opretter og admins)
```

Opretteren eller en admin vælger blandt de uafgjorte muligheder (`TieResolver`, virker uden JavaScript). Valget gemmes i `PollTieResolution` med hvem og hvornår, og derefter fortsætter flowet, som om der var en entydig vinder. Er den ene kategori afgjort, står den over valget ("Datoen er afgjort: tirsdag 3. november kl. 19:30 (2 kan)"). Medlemmer, der ikke kan vælge, ser stillingen og "Mads eller en admin vælger vinderen.". Nåede ingen at stemme: "Ingen nåede at stemme 🦗". Er en uafgjort dato allerede overstået, siger kortet, at eventet bliver oprettet som en tidligere smagning (E33). Vinderne gemmes aldrig; de beregnes fra stemmerne og valgene (§3.4).

`tallyPoll()` og `resolveWinner()` er rene domænefunktioner med grundige unit tests (§15.3).

### 9.7.7 Automatisk oprettelse af event

Når vinderne er fundet, oprettes et almindeligt event i **samme transaction**:

| Event-felt | Værdi |
|---|---|
| `title`, `description`, `theme` | Kopieres fra afstemningen |
| `startsAt` | Vindende dato og tid |
| `placeId` | Vindende sted |
| `hosts` | **Det vindende steds ejere, der er medlemmer.** Ellers afstemningens opretter, hvis vedkommende stadig er medlem (D-009), ellers den admin, der lukkede eller valgte vinderen (E11), ellers ingen (E34, "Ingen vært endnu"). |
| `endsAt` | Ingen |
| `createdById` | Afstemningens opretter (også når en admin lukkede den, eller opretteren er gået) |
| `pollId` | Afstemningens id (unik, sikrer idempotens) |

Resultatet vises på afstemningssiden og på Overblik:

```text
🎉 Afstemningen er afsluttet!

Lørdag 21. november · 18:30
Hos Mads
Vært: Mads

[ Se event ]
```

Eventet kan derefter redigeres som ethvert andet event. Eventsiden viser "Valgt ved afstemning 🗳" med et link til afstemningen. Afstemningssidens resultatkort (`PollOutcome`) viser også, hvorfor afstemningen sluttede ("Alle havde stemt.", "Fristen udløb …", "Afsluttet af Mads."), hvem der valgte efter en uafgjort ("Mads valgte stedet, da det stod lige."), og "Eventet fra afstemningen er slettet.", hvis nogen har slettet eventet.

### 9.7.8 Notifikationer

[SENERE] Email eller push ved ny afstemning, kort før frist og når eventet er oprettet. I MVP sørger Overblik for synligheden ("Du mangler at stemme").

---

## 9.8 Profil og indstillinger [MVP]

### Personlige indstillinger (`/c/[clubId]/profile`, D-023)

* **Identitet:** avatar (Google-billede eller initialer af visningsnavnet), visningsnavnet stort, "(Jesper Thomsen)", når der er et kælenavn, og emailen.
* **Navn** (officielt navn, påkrævet, 1–100 tegn)
* **Kælenavn** (valgfrit, 1–40 tegn, D-105). En live-forhåndsvisning viser "Sådan ser de andre dig: Kaptajnen (Jesper Thomsen)". "Gem profil" → "Gemt ✓".
* **Email** (kortet "Email", D-151): konti med password-login ser "Du logger ind med {email}." og **"Skift email"**: "Ny email", "Gentag ny email" og "Nuværende password". Emailen gemmes trimmet, med små bogstaver og som uverificeret. Ved feltet: et forkert password ("Det nuværende password er forkert."), ens egen email ("Det er allerede din email.") og en email, en anden konto har, eller en adresse i `APP_ADMIN_EMAILS` (samme tekst: "Den email bruges allerede af en anden konto."). Denne enhed forbliver logget ind, alle andre enheder logges ud, og udestående nulstillingslinks holder op med at virke ("Din email er skiftet. Dine andre enheder er logget ud."). Der sendes ingen bekræftelsesmail og ingen besked til den gamle adresse endnu (TG-033). Rene Google-konti ser "Du logger ind med Google, så din email følger din Google-konto."
* **Password** (skift: nuværende + nyt + gentag nyt, D-106). Denne enhed forbliver logget ind, alle andre enheder logges ud, og udestående nulstillingslinks holder op med at virke. Et forkert nuværende password vises ved feltet. Kun for konti med password-login. Rene Google-konti har i stedet **"Tilføj password"** (D-152): "Nyt password" + "Gentag nyt password", men kun mens Google-login'et er under 10 minutter gammelt (sessionens oprettelsestid). Ellers "Af sikkerhedshensyn skal du have logget ind med Google for nylig, før du kan tilføje et password." og [Log ind med Google igen] (Google-vælgeren foreslår kontoens email og sender tilbage til Profil). Bagefter kan kontoen også logge ind med email og password, andre enheder logges ud, og kortet bliver "Skift password". Google-login'et bevares.
* **"{Auth0|Google}-login"** (kortet hedder efter den udbyder, der er sat op, D-165, D-166; nedenfor med Google som eksempel, for Auth0 står der "Forbind Auth0" osv.): en konto med password og uden Google ser "Forbind din Google-konto, så kan du logge ind med ét tryk. Google-kontoen skal have samme email ({email})." og **[Forbind Google]** (Google-vælgeren foreslår kontoens email). Tilbage på Profil: "Google er forbundet." (kun når kontoen nu har Google) eller en fast fejltekst (anden email, ubekræftet email, Google-kontoen er koblet til en anden). En konto med Google ser "Du kan logge ind med Google." Har kontoen Google, står der under "Skift email": "Skifter du email, kobles dit Google-login fra. Du kan forbinde Google igen med den nye email." Et emailskift sletter Google-login'et i samme transaction (toast: "… Google-login er koblet fra, fordi det hørte til den gamle email. Forbind Google igen på Profil.").
* **Profilbillede** (fra Google i MVP. [SENERE] upload.)
* Links til Klubben, Steder, Mine klubber (fra to klubber) og "Opret eller join ny klub"
* Log ud
* [SENERE] Slet konto (anonymiserer brugeren: historik bevares som "Tidligere medlem").

### Kælenavn

* Bruges overalt i klubbens UI: "Oprettet af Kaptajnen", "Kaptajnen har rated denne øl 5/5".
* Det officielle navn findes stadig og vises fx på medlemslisten: "Kaptajnen (Jesper Thomsen)".
* **Visningsregel:** `kælenavn ?? navn`. Implementeres ét sted (`getDisplayName()`) og bruges overalt.
* **Ét globalt kælenavn [BESLUTNING]:** Kælenavnet gemmes på brugeren (`User.nickname`) og er det samme i alle klubber. Bliver der senere brug for kælenavne pr. klub, kan et valgfrit `Membership.nickname` tilføjes som override.
* Visningsnavnet bruges i sidebaren, "Oprettet af", "Tilføjet af", ratings (sorteret efter visningsnavn), værter, ejere, værtsvalget, medlemsmenuen og bekræftelser. Kun medlemslisten og profilen viser også det officielle navn. Emails bruger det officielle navn (D-105).
* Kælenavnet kan kun ændres via profilen. Better Auths `/update-user` og signup afviser feltet (D-105).

### Klubindstillinger (`/c/[clubId]/club`)

* Klubnavn, beskrivelse og "N medlemmer". Admins har [ Rediger klubinfo ] → `/club/edit` (navn + beskrivelse ≤ 300 tegn → "Gemt ✓", D-110).
* **Medlemmer:** avatar, visningsnavn, "(Jesper Thomsen)", "(dig)", Admin-mærke og "Medlem siden …". Admins har en '⋯'-menu pr. medlem, også på deres egen række (D-102, D-116): "Gør til admin", "Fjern admin-rollen" ("Fjern min admin-rolle" på egen række; deaktiveret med begrundelsen, når det er den sidste admin), "Lav nulstillingslink" (aldrig til en selv) og "Fjern fra klubben". Hver handling har en confirmation (fjern er destruktiv), og en toast bagefter nævner medlemmet ("Mads er nu admin").
* Siden er delt i sektioner med en tynd linje imellem (D-163): Medlemmer · Steder · invitationskortet · Farezone.
* **Medlemmer:** admins står altid først, så skiller en lidt kraftigere linje dem fra de øvrige medlemmer, der står alfabetisk (dansk rækkefølge).
* **Steder:** overskrift og rækken "N steder · Hvor I mødes, og hvem der ejer dem" (link til Steder).
* **Invitationskortet "Inviter dine ølbrødre":** "En tom klub er ikke sjov. Del linket i gruppechatten." Invitationskoden stort, linket, [ Kopiér link ] og [ Del ]; [ Generér ny kode ] (admin) nederst i kortet.
* **Farezone:** "Forlad klubben" (med confirmation; for den sidste admin begrundelsen og genvejen "Gør et medlem til admin", for det eneste medlem E3-teksten) og "Slet klubben" (admin, §7.5)

---

## 9.9 Feedback: fejlrapporter og feature-ønsker [MVP]

Brugerne skal kunne rapportere fejl og foreslå nye features direkte i appen. Rapporterne gemmes i databasen, og alle brugere kan se dem. Det giver Jesper (og AI-agenten) en backlog direkte fra brugerne.

### Afgrænsning [BESLUTNING, D-019]

* Feedback er **app-dækkende, ikke klub-specifik**. En fejl i kalenderen er den samme fejl for alle klubber, og app-admin skal kunne se alt ét sted.
* Alle **logget-ind brugere** kan se alle rapporter og oprette nye.
* Ingen integration med eksterne værktøjer (GitHub Issues, Linear osv.) i MVP. Det hele ligger i appens egen database.

### Hvor finder man det?

* **Profil → "Feedback (fejl og ønsker)"** → `/feedback`.
* **"Feedback"** i footeren "Logget ind som … · Log ud" på `/onboarding`, `/clubs` og `/join`, så også en bruger uden klubber kan finde den (D-147).
* På **fejlsiderne** (fejlgrænserne `error.tsx` i roden, i klubben og i feedback, og `global-error.tsx`) vises knappen "Rapportér denne fejl" ved siden af "Prøv igen". Den åbner formularen med typen *Fejl* valgt og siden udfyldt på forhånd (uden klub-id, D-143). Ikke på 404-sider, og ikke ved fejlbeskeder i formularer og toasts (D-150). Fejlkoden (digest) vises som før, men kommer aldrig med i linket.
* Der er bevidst **ikke** et punkt i hovednavigationen. Den er forbeholdt klubbens kernefunktioner.
* **Ramme (D-147):** siderne vises i AppShell for den senest aktive klub (ellers den første) med Profil markeret; uden klubber i en enkel ramme med logo, "Tilbage" og "Logget ind som …". Feedbackens layout skriver aldrig (husker ikke aktiv klub).

### Opret feedback (`/feedback/new`)

```text
Hvad drejer det sig om?
  ( ● 🐞 Fejl )   ( ○ 💡 Idé / ønske )

Titel
[ Kalenderen viser forkert dato på mobil ]

Beskrivelse
[ Hvad skete der? Hvad forventede du?            ]
[ (Fejl: hvordan kan vi gentage den?)            ]

Side (udfyldt automatisk, kan rettes)
[ /calendar ]

ⓘ Din rapport kan ses af alle brugere af appen.

[ Send ]
```

| Felt | Påkrævet | Note |
|---|:-:|---|
| Type | ✅ | `BUG` (Fejl) eller `FEATURE` (Idé/ønske) |
| Titel | ✅ | 3–120 tegn |
| Beskrivelse | ✅ | 10–5000 tegn. Placeholder-teksten guider efter typen. |
| Side | – | Kun ved fejl. Udfyldes med den side, brugeren kom fra. **Klub-id fjernes fra stien** (`/c/abc123/calendar` gemmes som `/calendar`), så andre brugere ikke ser klubdata. Strammere (D-143): query og `#hash` fjernes også (`?q=`, `?token=`), `/join/<kode>` gemmes som `/join`, kun en sti med præcis ét `/` foran godtages (ellers feltfejlen "Skriv en sti, fx /calendar."), og den skæres ved 200 tegn. Samme funktion (`toFeedbackPagePath`) bruges i linket "Rapportér denne fejl", i formularens forudfyldning og i serveren. |
| Teknisk info | – | Ved fejl gemmes browser/enhed (user agent) og skærmbredde automatisk. **Kun synlig for app-admin.** |

Efter oprettelse: "Tak! Din rapport er gemt 🍻", og brugeren sendes til rapportens detaljeside.

### Oversigt (`/feedback`)

```text
Feedback                               [ + Ny rapport ]

[ Alle ] [ 🐞 Fejl ] [ 💡 Ønsker ]     Status: [ Åbne ▼ ]
Sorter: [ Flest stemmer ▼ ]

🐞 Kalenderen viser forkert dato på mobil
   Ny · Kaptajnen · for 2 dage siden          👍 4

💡 Mørkt tema
   Planlagt · Mads · for 1 uge siden          👍 7  (du har stemt)

💡 Statistik over mest drukne øltype
   Færdig ✓ · Anders · for 3 uger siden       👍 5
```

* **Filtre:** type (alle/fejl/ønsker) og status (åbne = Ny, Planlagt og I gang · lukkede = Færdig, Afvist og Dublet (D-144) · alle). URL: `/feedback?type=bug|feature&status=closed|all&mine=1&sort=newest` (standardværdier udelades).
* **Sortering:** flest stemmer (standard; ved lighed nyeste), nyeste. Listen viser højst 200 rapporter (TG-057).
* **Søgning** i titel og beskrivelse [SENERE, når der er mange rapporter].
* **"Mine rapporter"** som ekstra filter.

### Stem op ("Jeg har også det problem" / "Det vil jeg også gerne have")

* Hver bruger kan give **én 👍 pr. rapport** og fjerne den igen (toggle, optimistisk UI).
* Man kan ikke stemme på sin egen rapport (den tæller automatisk som 1).
* Antallet beregnes ud fra stemmerne og gemmes ikke (§3.4).
* Det mindsker dubletter: før man opretter en ny rapport, bliver man opfordret til at se, om den allerede findes. Formularen viser op til 3 **lignende rapporter**, når man har skrevet titlen (simpel tekstsøgning på titel): "Findes den allerede?" med status og 👍, fra 3 tegn og efter en kort pause. Siden sender titlerne på de 300 nyeste rapporter, og browseren matcher med samme rene funktion som serveren (`findSimilarFeedback`). Linkene åbner i en ny fane, så kladden bevares (D-149).

### Detaljeside (`/feedback/[feedbackId]`)

Viser type, titel, beskrivelse, status, opretter (visningsnavn), dato, antal 👍 og 👍-knap. App-admin ser desuden den tekniske info, kan ændre status og kan skrive et kort **svar** ("Rettet i version fra 12/10" eller "Giver mening – planlagt efter afstemninger").

Implementeret (2026-10-18): ved en fejl står "Side: /calendar". Beskrivelse og svar vises som ren tekst med linjeskift. En dublet viser "Dublet af «titel»" med link, eller "Dublet (den originale rapport er slettet)". 👍-knappen siger, hvad den gør ("👍 Jeg har også det problem" ved en fejl, "👍 Det vil jeg også gerne have" ved en idé, "Fjern min 👍"), er optimistisk og har ingen `aria-pressed` (som ejer-toggle, D-115). På sin egen rapport står i stedet "Din rapport tæller automatisk som 1 👍". [Ret] og [Slet rapport] (med bekræftelse) vises for forfatteren, mens rapporten er Ny, og for app-admin. App-admin ser "Teknisk info (kun synlig for dig)" (ved fejl) og formularen "Status og svar": Status, "Original rapport" (kun ved Dublet), et svar med tælleren "N / 2000 tegn" og tippet "Skriv gerne en begrundelse." ved Afvist.

### Status

| Status | Dansk | Hvem sætter den |
|---|---|---|
| `NEW` | Ny | Automatisk ved oprettelse |
| `PLANNED` | Planlagt | App-admin |
| `IN_PROGRESS` | I gang | App-admin |
| `DONE` | Færdig ✓ | App-admin |
| `WONT_DO` | Afvist | App-admin (bør have et svar med begrundelse) |
| `DUPLICATE` | Dublet | App-admin, med henvisning til den originale rapport |

### Rettigheder

| Handling | Bruger | Opretter | App-admin |
|---|:-:|:-:|:-:|
| Se alle rapporter | ✅ | ✅ | ✅ |
| Oprette rapport | ✅ | ✅ | ✅ |
| Give/fjerne 👍 | ✅ | ❌ (egen) | ✅ |
| Redigere titel/beskrivelse | ❌ | 🟡 mens status er *Ny* | ✅ |
| Slette rapport | ❌ | 🟡 mens status er *Ny* | ✅ |
| Ændre status, skrive svar, markere som dublet | ❌ | ❌ | ✅ |
| Se teknisk info | ❌ | ❌ | ✅ |

**App-admin [BESLUTNING]:** Bestemmes af miljøvariablen `APP_ADMIN_EMAILS` (kommasepareret). Der er ingen UI til at uddele rollen, og den er uafhængig af klubroller. En klub-admin er altså ikke automatisk app-admin. Emailen sammenlignes præcist efter trim og lowercase (`isAppAdmin`, D-142), **og kontoens email skal være bekræftet** (D-165): et Google-login eller "Forbind Google" bekræfter den, et emailskift nulstiller den. Password-signup bekræfter ikke emails (D-029), så en konto, som en anden har oprettet på adressen, bliver aldrig app-admin (TG-060).

**Implementeringsnoter (D-145):** En manglende rettighed giver `FORBIDDEN` (rapporterne er offentlige for alle brugere), kun et ukendt id giver 404. Ret og slet skrives med `WHERE id AND created_by_id = mig AND status = 'NEW'` (app-admin: kun id), så en samtidig statusændring vinder ("Rapporten er ikke længere ny, så den kan ikke rettes."). 👍 er én `INSERT … SELECT … WHERE created_by_id IS DISTINCT FROM mig ON CONFLICT DO NOTHING`. Moderation sker i én transaction under rækkelåse på rapporten og originalen: en dublet skal pege på en rapport, der findes og ikke selv er en dublet; andre statusser rydder henvisningen. Brugerens browser (user agent) læses på serveren fra requesten, aldrig fra formularen, og teknisk info vælges kun i forespørgslen for app-admins.

### Misbrug og grænser

* Rate limiting: maks. 10 rapporter pr. bruger pr. døgn ("Du kan sende højst 10 rapporter i døgnet. Prøv igen om N timer."). 👍 og rettelser er ikke begrænset (TG-058).
* Teksten vises som ren tekst (ingen HTML, ingen markdown-rendering i MVP). Linjeskift bevares.

### AI-agent og feedback

AI-agenten kan bruge feedback som input til backlog'en:

* Scriptet `scripts/list-feedback.ts` (`npm run feedback:list`) udskriver åbne rapporter (Ny, Planlagt, I gang; flest 👍, så nyeste) fra databasen i `DATABASE_URL`, så agenten kan læse dem uden at gå gennem UI'et. Det læser kun. Indstillinger: `--type bug|feature`, `--limit N` (standard 50), `--json`, `--with-tech` (browser og skærmbredde, slået fra som standard), `--remote` (påkrævet for en database, der ikke er lokal; ingen TTY-bekræftelse, D-146), `-h/--help`. Målet udskrives altid først med maskeret password, og forfatteren vises som visningsnavn, aldrig email. Exit-koder 0/1/2.
* Når en rapport bliver rettet, nævnes rapportens id i fejlloggen (§19.4), og app-admin sætter status til *Færdig*.

---

# 10. Brugerflows

## 10.1 Efter login – routing-logik

```text
Login
  ↓
Ventende invitationskode i session? ──JA──► /join/[code] (bekræft) ──► klubbens Overblik
  ↓ NEJ
Antal klubber?
  ├─ 0  ──► /onboarding (Opret / Join)
  ├─ 1  ──► /c/[clubId]  (ingen ekstra klik)
  └─ 2+ ──► lastActiveClubId sat og stadig medlem?
              ├─ JA  ──► /c/[lastActiveClubId]
              └─ NEJ ──► /clubs (klubvælger)
```

## 10.2 Første login

```text
Login → ingen klubber → Onboarding → Opret klub / Join klub → Overblik
```

## 10.3 Bruger med flere klubber

```text
Login → sidst brugte klub huskes → Overblik
                                        ↓
                         Tryk på klubnavn ▾ → vælg anden klub → Overblik (ny klub)
```

Ved hvert klubskift opdateres `lastActiveClubId`.

## 10.4 Opret event

```text
Overblik → [ + Opret event ] → formular (titel foreslået, sted vælges, værter udfyldes)
        → Gem → Event detail → vises på Overblik og i Kalender
```

## 10.5 Rate øl (under smagning)

```text
Overblik (event "I gang nu") → [ Tilføj øl ] → navn + % (event udfyldt) → Gem
        → Øl-detail → tryk stjerner → "Gemt ✓" → klubbens gennemsnit opdateret
```

## 10.6 Afstemning

```text
Overblik → [ Planlæg ølsmagning ] → datoer + steder + frist → Opret
  → Medlemmer ser "Du mangler at stemme" på Overblik → stemmer
  → Deadline / alle har stemt / manuel afslutning
  → Entydig vinder → Event oprettes automatisk → vises overalt
  → Uafgjort → opretter vælger vinder → Event oprettes
```

## 10.7 Join via link

```text
Modtager link i gruppechat → /join/K7XMQ2PA
  → (ikke logget ind) → login/signup → tilbage til join
  → "Du er inviteret til Drengene & Bajere (8 medlemmer)" → [ Join klub ] → Overblik
```

---

# 11. Datamodel

Notation: `?` = nullable. Alle tabeller har `createdAt`, og redigerbare tabeller har `updatedAt`. Auth-bibliotekets egne tabeller (accounts, sessions, verification tokens) er ikke vist.

```text
User
  id
  name                    String
  nickname?               String (1–40)     -- globalt kælenavn, CHECK efter trim (D-105)
  email                   String   UNIQUE (lowercase)
  emailVerified           Boolean
  image?                  String
  lastActiveClubId?       → Club   (ON DELETE SET NULL)
  deletedAt?              DateTime (anonymiseret konto)

Club
  id
  name                    String (1–60)
  description?            String (1–300)    -- CHECK efter trim (D-110)

Membership
  id
  userId                  → User  (CASCADE)
  clubId                  → Club  (CASCADE)
  role                    ADMIN | MEMBER
  joinedAt                DateTime
  UNIQUE (userId, clubId)
  -- app-regel (domæne, i transaction): mindst én ADMIN pr. klub

Invite
  id
  clubId                  → Club  (CASCADE)
  code                    String UNIQUE
  createdById             → User
  revokedAt?              DateTime
  expiresAt?              DateTime          [SENERE i brug]
  UNIQUE (clubId) WHERE revokedAt IS NULL   -- én aktiv kode pr. klub

Place
  id
  clubId                  → Club  (CASCADE)
  name                    String (1–120)    -- renset (NFC, samlede mellemrum, trim)
  nameKey                 String            -- placeNameKey(name): dansk lowercase uden whitespace, aldrig tom
  address?                String (1–200)
  description?            String (1–1000)
  createdById             → User  (RESTRICT)
  archivedAt?             DateTime
  UNIQUE (id, clubId)                       -- mål for de sammensatte FK'er (D-096)
  UNIQUE (clubId, nameKey) WHERE archivedAt IS NULL   -- ét aktivt sted pr. navn (D-095)
  INDEX (clubId)

PlaceOwner
  placeId, clubId         → Place (id, clubId)              (CASCADE)
  userId, clubId          → Membership (userId, clubId)     (CASCADE)  -- ejeren er medlem; ejerskabet ophører med medlemskabet
  userId                  → User  (CASCADE)
  PRIMARY KEY (placeId, userId)
  INDEX (userId, clubId)

Event
  id
  clubId                  → Club  (CASCADE)
  title                   String (1–100)
  theme?                  String
  description?            Text
  startsAt                timestamptz
  endsAt?                 timestamptz       CHECK (endsAt IS NULL OR endsAt > startsAt)
  placeId, clubId         → Place (id, clubId)  (RESTRICT; steder arkiveres i stedet for at slettes)
                                            -- påkrævet fra runde 3; stedet er i eventets klub (D-096)
  createdById             → User
  pollId?, clubId         → Poll (id, clubId)  (RESTRICT) UNIQUE (pollId)
                                            -- sat når eventet er skabt af en afstemning (D-007, D-129)
  -- locationText er droppet i runde 4 (TG-032, D-139)
  INDEX (clubId, startsAt)
  INDEX (placeId)

EventHost
  eventId                 → Event (CASCADE)
  userId                  → User  (RESTRICT; værtskaber er historik, D-072/D-096)
  PRIMARY KEY (eventId, userId)
  INDEX (userId)
  -- app-regel: nye værter er medlemmer (tjekkes under FOR SHARE på medlemskaberne)

Beer
  id
  clubId                  → Club  (CASCADE)
  name                    String (1–120)
  abv                     Decimal(3,1)  CHECK (abv >= 0 AND abv < 100)
  eventId?                → Event (ON DELETE SET NULL)
  createdById             → User
  INDEX (clubId, name)
  -- app-regel: event.clubId = beer.clubId

BeerRating
  id
  beerId                  → Beer  (CASCADE)
  userId                  → User
  value                   SmallInt  CHECK (value BETWEEN 2 AND 10)   -- halve point: 2 = 1,0 … 10 = 5,0
  UNIQUE (beerId, userId)

Song                                        -- D-121
  id                      UUIDv7
  clubId                  → Club  (CASCADE)
  title                   String   CHECK 1–120 efter btrim
  titleKey                String   CHECK <> ''      -- nameKey(title): NFC, samlede mellemrum, dansk lowercase
  artist?                 String   CHECK NULL eller 1–120
  melody?                 String   CHECK NULL eller 1–120 -- vises som "Mel.: …"
  body                    Text     CHECK ≤ 20.000 og ikke kun blanktegn/linjeskift -- sangtekstformatet (§9.6)
  sourceKey?              String   CHECK NULL eller 1–300 -- importens kildefil, fx 'chordbank:<fil.pdf>'
  importHash?             String   CHECK NULL eller ^[0-9a-f]{64}$ -- sha256 af [title, artist, melody, body] ved import
  createdById             → User  (RESTRICT)
  createdAt, updatedAt
  UNIQUE (clubId, titleKey)
  UNIQUE (clubId, sourceKey)
  CHECK (sourceKey IS NULL) = (importHash IS NULL)
  -- app-regel: appens skrivninger rører aldrig sourceKey/importHash (kun importscriptet)
  -- implementeringsnote: body må aldrig søges eller vises råt – brug parseSong/lyricsOnlyLines (domain/songs/song-text.ts)

Poll                                        -- D-129
  id
  clubId                  → Club  (CASCADE)
  title                   String (1–100)    -- samme CHECKs som Event, så kopien til eventet aldrig fejler
  theme?                  String (1–80)
  description?            Text (1–5000)
  deadline                timestamptz
  status                  OPEN | AWAITING_DECISION | CLOSED | CANCELLED  DEFAULT OPEN
  closeReason?            DEADLINE | ALL_VOTED | MANUAL
  closedAt?               timestamptz       -- sat sammen med closeReason; bevares ved en senere annullering
  closedById?             → User  (RESTRICT)  -- kun ved closeReason = MANUAL
  cancelledAt?            timestamptz
  cancelledById?          → User  (RESTRICT)
  createdById             → User  (RESTRICT)
  createdAt, updatedAt
  UNIQUE (id, clubId)                       -- mål for de sammensatte FK'er fra PollOption og Event
  INDEX (clubId, status)
  INDEX (status, deadline)                  -- cron og lazy close
  CHECK title/theme/description (længde efter btrim)
  CHECK OPEN ⇒ ingen close*/cancelled*
  CHECK AWAITING_DECISION/CLOSED ⇒ closeReason sat, ingen cancelled*
  CHECK CANCELLED ⇒ cancelledAt og cancelledById sat
  CHECK (closeReason IS NULL) = (closedAt IS NULL)
  CHECK (closeReason = MANUAL) = (closedById IS NOT NULL)

PollOption
  id
  pollId, clubId          → Poll (id, clubId)   (CASCADE)
  category                DATE | PLACE
  startsAt?               timestamptz       -- når category = DATE
  placeId?, clubId        → Place (id, clubId)  (RESTRICT; et sted i en afstemning arkiveres, D-132)
  CHECK ((category='DATE'  AND startsAt IS NOT NULL AND placeId IS NULL) OR
         (category='PLACE' AND placeId  IS NOT NULL AND startsAt IS NULL))
  UNIQUE (pollId, startsAt)
  UNIQUE (pollId, placeId)
  UNIQUE (id, pollId, category)             -- mål for FK'erne fra PollVote og PollTieResolution
  INDEX (placeId)
  -- Valgmulighederne ændres kun, mens afstemningen er åben og har 0 stemmesedler (D-153);
  -- uændrede beholder deres id (poll_votes → poll_options er CASCADE, derfor tælles
  -- stemmesedlerne under lockPoll).

PollBallot                                  -- én stemmeseddel pr. medlem pr. afstemning; kun komplette gemmes
  id
  pollId                  → Poll  (CASCADE)
  userId                  → User  (RESTRICT; stemmer er historik)
  noDateWorks             Boolean DEFAULT false   -- "Ingen af datoerne passer mig"
  createdAt, updatedAt
  UNIQUE (pollId, userId)
  UNIQUE (id, pollId)                       -- mål for PollVote's sammensatte FK

PollVote                                    -- ét kryds på én valgmulighed
  ballotId, pollId        → PollBallot (id, pollId)              (CASCADE)
  optionId, pollId, category → PollOption (id, pollId, category) (CASCADE)
                                            -- samme afstemning og samme kategori er DB-regler
  PRIMARY KEY (ballotId, optionId)          -- intet dobbeltkryds
  UNIQUE (ballotId) WHERE category = 'PLACE'  -- højst ét sted pr. stemmeseddel (partielt index)
  INDEX (optionId)
  -- app-regel: noDateWorks = true ⇒ ingen DATE-kryds på samme stemmeseddel (TG-052)

PollTieResolution                           -- valget ved uafgjort
  pollId                  → Poll  (CASCADE)
  category                DATE | PLACE
  chosenOptionId, pollId, category → PollOption (id, pollId, category) (CASCADE)
  chosenById              → User  (RESTRICT)
  chosenAt                timestamptz
  PRIMARY KEY (pollId, category)
  -- vinderne gemmes aldrig: de beregnes af tallyPoll + resolveWinner (§3.4)

Feedback                                    -- app-dækkende, INGEN clubId (§9.9, D-141)
  id                      UUIDv7
  type                    BUG | FEATURE
  title                   String (3–120)    -- CHECK efter btrim og ≤ 120 råt
  description             Text (10–5000)    -- CHECK efter btrim
  pagePath?               String            -- klub-id, query og hash fjernet (D-143); CHECK starter med '/' og ≤ 200
  userAgent?              String            -- kun synlig for app-admin; CHECK 1–500
  viewportWidth?          Int               -- kun synlig for app-admin; CHECK 1–20.000
  status                  NEW | PLANNED | IN_PROGRESS | DONE | WONT_DO | DUPLICATE  DEFAULT NEW
  adminResponse?          Text              -- CHECK 1–2000 efter btrim
  duplicateOfId?          → Feedback (ON DELETE SET NULL)
  createdById?            → User  (ON DELETE SET NULL, "Tidligere bruger")
  createdAt, updatedAt
  INDEX (status, createdAt)
  INDEX (createdById)
  INDEX (duplicateOfId)
  CHECK duplicateOfId <> id
  CHECK duplicateOfId IS NULL OR status = 'DUPLICATE'     -- envejs: SET NULL ved slettet original bryder den aldrig
  CHECK type = 'BUG' OR (pagePath, userAgent, viewportWidth alle NULL)
  -- 👍-tallet gemmes aldrig: 1 (forfatteren) + antal FeedbackVote (§3.4, D-144)

FeedbackVote
  feedbackId              → Feedback (CASCADE)
  userId                  → User     (CASCADE)
  createdAt
  PRIMARY KEY (feedbackId, userId)
  INDEX (userId)
  -- app-regel: man kan ikke stemme på egen rapport; håndhævet i selve INSERT'en (D-145), ikke som constraint (TG-059)
```

**Hvorfor én `PollOption`-tabel med `category`** (i stedet for separate `DateOption`/`PlaceOption`)? Stemmer bliver én simpel tabel, reglerne pr. kategori (mange datoer / ét sted) bliver constraints, og nye kategorier (fx *tema* eller *øltype*) kan tilføjes senere uden nye tabeller.

**Hvorfor `PollBallot`?** "Har stemt" bliver et simpelt opslag (der findes en stemmeseddel), "Ingen af datoerne passer" har et naturligt sted at bo, og når man gemmer sin stemme, kan alle kryds erstattes atomisk i én transaction.

**Hvorfor ingen `Club.ownerId` eller `createdById` med særrettigheder?** Rettigheder ligger kun i `Membership.role`, så der aldrig er to kilder til sandhed. Reglen "mindst én admin" tjekkes i domænelaget: hver ændring af roller og medlemskaber låser klubbens række (`SELECT id FROM clubs … FOR NO KEY UPDATE`) og læser aktørens rolle og hele medlemslisten igen under låsen, så to admins ikke samtidig kan nedgradere hinanden til nul admins (D-102, erstatter "lås admin-medlemskaberne").

**Implementeringsnoter (runde 1, 2026-10-08):**

* **Navngivning (D-026):** Prisma-modeller i PascalCase, tabeller i snake_case flertal (`users`, `clubs`, `memberships`, `invites` …) og kolonner i snake_case via `@map`.
* **Id'er (D-026):** alle tabeller bruger UUIDv7 som tekst (`@default(uuid(7))`), og Better Auth genererer også UUID'er. Et ugyldigt id i URL'en afvises med `isValidId()` → 404, før databasen spørges.
* **Ekstra tabeller:** Better Auths egne (`sessions`, `accounts`, `verifications`, `rate_limits`) og appens `app_rate_limits` (fast vindue: `key`, `count`, `expires_at`).
* **Ekstra constraints (D-034):** CHECK på `users.name` (1–100 efter trim), `users.email = lower(email)`, `clubs.name` (1–60) og `invites.code` (`^[2-9A-HJKMNP-Z]{8}$`). `Membership` har også `updatedAt`.
* **Én aktiv invitation pr. klub (D-027)** er et partielt unikt index, der er erklæret i Prisma-schemaet via preview-featuren `partialIndexes`. **Fælde:** Brug aldrig `invite.findUnique({ where: { clubId } })`, da den ignorerer `revoked_at IS NULL`. Brug `findFirst({ where: { clubId, revokedAt: null } })`.

**Implementeringsnoter (runde 3, 2026-10-09):**

* **Migrering (D-097):** én migrering (`20261009084837_round3_places_hosts_nickname`) laver `places`, `place_owners`, `event_hosts` og `users.nickname`, migrerer runde 2's fritekst til steder (ét pr. klub og navnenøgle) og gør `events.place_id` påkrævet. Alle eksisterende events fik opretteren som vært. Testet på en midlertidig database (`round3-migration.itest.ts`).
* **Club isolation i databasen (D-096):** de sammensatte FK'er `events(place_id, club_id) → places(id, club_id)` og `place_owners(place_id, club_id) → places`, `place_owners(user_id, club_id) → memberships(user_id, club_id)`. Skriv kun med "unchecked" skalar-input (`clubId`, `placeId`), aldrig `connect`, og aldrig `SetNull` på en sammensat relation (D-073).
* **CHECK-constraints:** `users_nickname_length_check`, `clubs_description_length_check`, `places_name_length_check`, `places_name_key_not_empty_check`, `places_address_length_check`, `places_description_length_check` (alle på længden efter `btrim`).
* **Låse (D-095, D-102):** al rå SQL ligger i `src/server/db/locks.ts`. Fast rækkefølge: klub → stednavne (advisory lock pr. klub) → stedets række → eventets række → medlemskaber. Man fanger aldrig en Prisma-fejl og fortsætter i samme interaktive transaction (Postgres afbryder den), så alle invarianter tjekkes på forhånd under låse, og indexes/FK'er er kun sikkerhedsnet.
* **Fælde (som TG-004):** Brug aldrig `place.findUnique` på `clubId_nameKey`, da den ignorerer `archived_at IS NULL`. Brug `findFirst({ where: { clubId, nameKey, archivedAt: null } })`.

**Implementeringsnoter (runde 4, 2026-10-14):**

* **Migrering:** én migrering (`20261014054829_round4_polls`) laver `polls`, `poll_options`, `poll_ballots`, `poll_votes` og `poll_tie_resolutions`, tilføjer `events.poll_id` og dropper `events.location_text` med sin CHECK (TG-032, D-139). To håndrettelser: CHECK'en droppes eksplicit før kolonnen, og 9 CHECKs tilføjes til sidst. Drift-tjekket (`prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` mod den migrerede dev-database) skal give en tom migrering (F-075).
* **Sammensatte FK'er (D-129, som D-096):** `poll_options(poll_id, club_id) → polls`, `poll_options(place_id, club_id) → places`, `events(poll_id, club_id) → polls` (RESTRICT), og stemmerne peger på stemmesedlen og valgmuligheden i samme afstemning og kategori. `Poll.events` er i Prisma `Event[]`, men har 0 eller 1 række (`events_poll_id_key`); læs den som `events[0]`.
* **Låse (D-130):** `lockPoll` (`FOR NO KEY UPDATE`) tages af **alle**, der skriver til en afstemning, også den, der stemmer. Fast rækkefølge: klub → afstemninger → stednavne (advisory) → steder → event → medlemskaber. `endMembership` låser klubbens åbne afstemninger (`lockOpenPollIds`) før medlemskabet slettes, og `deleteClub` låser alle klubbens afstemninger (`lockClubPollIds`, `FOR UPDATE`). Under afstemningens lås læses den stemmendes medlemskab uden lås: det er korrekt, fordi `endMembership` er den eneste vej, der sletter et medlemskab i en klub, der findes. En ny vej, der sletter medlemskaber, skal også låse åbne afstemninger først.
* **Fælder:** Prisma genererer en `WhereUniqueInput` på `PollVote.ballotId` ud fra det partielle index. Brug aldrig `findUnique({ where: { ballotId } })`. Skriv kun med unchecked skalarer.

**Implementeringsnoter (feedback, 2026-10-16):**

* **Migrering:** én migrering (`20261016131043_feedback`) laver enums `feedback_type`/`feedback_status`, tabellerne `feedback` og `feedback_votes` og til sidst 9 navngivne CHECKs i rå SQL (`feedback_title_length_check`, `feedback_description_length_check`, `feedback_page_path_check`, `feedback_user_agent_length_check`, `feedback_viewport_width_check`, `feedback_admin_response_length_check`, `feedback_duplicate_not_self_check`, `feedback_duplicate_status_check`, `feedback_tech_info_bug_only_check`). Drift-tjekket giver en tom migrering (F-075).
* **Låse (D-145):** `lockFeedbackRows` (`FOR NO KEY UPDATE`, id-orden) i `src/server/db/locks.ts`, kun til moderation. Feedback har ingen klub og indgår ikke i klub-låserækkefølgen.
* **Længder tælles som Postgres (F-077):** schemaerne tæller kodepunkter, ikke UTF-16-enheder, så "🍺🍺" er 2 tegn og afvises af både formular og CHECK.

---

# 12. Edge cases

| # | Situation | Forventet adfærd |
|---|---|---|
| E1 | Bruger forlader eller fjernes fra klub | Se §7.4: medlemskab, stedejerskaber, værtskaber på kommende events og åbne stemmer fjernes. Ratings og historik (også værtskaber på afholdte events) bevares. |
| E2 | Sidste admin vil forlade klub, fjernes eller nedgraderes | Blokeres: "Klubben skal have mindst én admin. Gør et andet medlem til admin først." Ved "Forlad klubben" med genvejen "Gør et medlem til admin" (D-102). |
| E3 | Admin er eneste medlem | Kan slette klubben. Forlad er blokeret (E2). |
| E4 | Sted bruges af events og skal "slettes" | Arkiveres (§9.4). Events viser det stadig. |
| E5 | Sted er valgmulighed i åben eller uafgjort afstemning | Kan hverken arkiveres eller slettes, før afstemningen er afgjort eller annulleret. Stedets side forklarer det og linker til afstemningen (D-132). |
| E6 | Stemme efter deadline (fx formular åben for længe) | Serveren lukker afstemningen (`DEADLINE`) og afviser stemmen: "Afstemningen er lukket 🔒". Siden genindlæses med resultatet. |
| E7 | To medlemmer udløser lukning samtidig | Betinget `UPDATE … WHERE status='OPEN'` + unik `Event.pollId`, så kun ét event oprettes. |
| E8 | Alle har stemt | Lukker automatisk med `closeReason = ALL_VOTED`. |
| E9 | Uafgjort (også 0 stemmer) | `AWAITING_DECISION`. Opretter/admin vælger. Ingen tilfældig vinder. |
| E10 | Vindende sted har 0 ejere | Afstemningens opretter bliver vært (hvis stadig medlem, ellers E11/E34). |
| E11 | Afstemningens opretter forlader klubben | Admins kan stadig afslutte, annullere, rette og vælge vinder; den tidligere opretter får 404. Har vinderstedet ingen ejere, bliver den admin, der lukker eller vælger, vært. Eventets `createdById` er stadig opretteren. |
| E12 | Nyt medlem joiner under åben afstemning | Kan stemme. Tæller med i "alle har stemt" fra nu af. |
| E13 | Event med tilknyttede øl slettes | `Beer.eventId → null`. Øl og ratings bevares. |
| E14 | Øl slettes | Ratings slettes med (cascade) efter confirmation, der viser antallet af ratings. |
| E15 | `lastActiveClubId` peger på klub, man ikke længere er medlem af | Ignoreres, og normal routing (§10.1) bruges. |
| E16 | Bruger fjernes fra klub, mens de har appen åben | Næste request til klubben giver 404, og brugeren sendes til `/`. |
| E17 | Join-kode til klub man allerede er medlem af | Redirect til klubben, ingen fejl. |
| E18 | Ugyldig eller tilbagekaldt invitationskode | "Koden virker ikke længere. Spørg efter et nyt link." |
| E19 | Google-login med email der findes som password-konto | Kobles **ikke** (D-165). Beskeden henviser til password-login og "Forbind Google" på Profil, eller "Glemt password" (§6.2). |
| E20 | Sommer-/vintertid mellem oprettelse og event | Tider gemmes i UTC og vises i Europe/Copenhagen. 18:30 forbliver 18:30. |
| E21 | Dublet-øl | Advarsel med link, men oprettelse er tilladt (§9.5). |
| E22 | ID fra en anden klub i URL'en | 404. |
| E23 | Sidste admin i en klub vil slette sin konto | Blokeres, indtil en anden er gjort til admin, eller klubben er slettet. |
| E25 | To admins nedgraderer/fjerner hinanden samtidig | Transaction + lås på klubbens række sikrer, at der altid er mindst én admin tilbage (D-102). Den ene får "Klubben skal have mindst én admin …". |
| E26 | Fejlrapport oprettet fra en klubside | Klub-id fjernes fra den gemte sti, og det samme gør query og `#hash` (D-143). Klubnavn gemmes ikke (§9.9). |
| E27 | Opretteren af en rapport sletter sin konto | Rapporten bevares og vises som "Tidligere bruger". Opretterens stemmer slettes. |
| E28 | En rapport markeres som dublet | Status `DUPLICATE` med link til originalen. 👍 flyttes ikke automatisk. |
| E24 | Afstemningens frist forlænges efter nogen har stemt | Tilladt (kun forlængelse). Stemmer bevares. Før første stemme gælder oprettelsens regler, så fristen også må rykkes tidligere (D-153). |
| E29 | "＋ Nyt sted" med et navn, klubben allerede har (fx " hos  MADS ") | Formularen siger "«Hos Mads» findes allerede." med [ Vælg det ]. Sendes den alligevel, genbruges det aktive sted. På "Nyt sted"-siden afvises navnet med et link til stedet (D-095, D-099). |
| E30 | Et event på et sted, der siden er arkiveret, redigeres | Stedet står stadig som valgt ("Hos Mads (arkiveret)") og må blive. Andre arkiverede steder kan ikke vælges. |
| E31 | En vært har forladt klubben | Værtskabet bevares på startede og afholdte events. Ved redigering står værten som "(tidligere medlem)" og må blive, men kan ikke vælges igen. Værtskaber på kommende events fjernes, når medlemskabet ophører. |
| E33 | Uafgjort afgøres efter den uafgjorte dato | Tilladt: eventet oprettes som en tidligere smagning. Valget siger det på forhånd ("Datoen er overstået – eventet bliver oprettet som en tidligere smagning."). |
| E34 | Automatisk lukning, opretteren er gået, og vinderstedet har ingen ejere | Eventet oprettes uden vært ("Ingen vært endnu"), og værter kan tilføjes ved redigering. |
| E35 | "Skift email" til en email, en anden konto har (fx "  Mads@Example.com "), til ens egen email eller til en adresse i `APP_ADMIN_EMAILS` | Afvises ved feltet: "Den email bruges allerede af en anden konto." (også for app-admin-adresser, så listen ikke kan aflures og app-admin ikke kan overtages) eller "Det er allerede din email." Intet ændres. To samtidige skift til samme email afgøres af det unikke index (D-151). |
| E36 | "Tilføj password" sendes, efter siden har stået åben i over 10 minutter | Afvises uden at kalde Better Auth: "Log ind med Google igen for at tilføje et password." og [Log ind med Google igen]. Har kontoen imens fået et password i en anden fane: "Du har allerede et password. Brug 'Skift password'." (D-152). |
| E37 | Nogen stemmer, mens opretteren retter datoer og steder | Afgøres under afstemningens lås (D-130): kommer stemmen først, afvises rettelsen med "Nogen har stemt i mellemtiden, så datoer og steder kan ikke længere ændres. Intet er gemt.", og siden viser dem skrivebeskyttet (titel og frist kan stadig gemmes); kommer rettelsen først, afvises en stemmeseddel med forældede valg med "Afstemningen er ændret. Genindlæs siden." Et tidligere medlems stemmeseddel tæller også (D-153). |
| E32 | Et ubrugt sted fjernes, mens nogen opretter et event på det | Afgøres under en rækkelås: enten oprettes eventet først, og stedet arkiveres så i stedet for at blive slettet, eller stedet slettes først, og eventet afvises med "Stedet findes ikke længere. Vælg et andet." Aldrig en databasefejl (D-100). |

---

# 13. Visuel retning og designsystem

## 13.1 Stemning

**Moderne ølklub + hyggeligt fællesskab + let maritim identitet.**

* Hyggelig, varm og personlig. Ikke corporate.
* Diskrete maritime detaljer: tynde, rolige linjer som skillelinjer (D-163), kompas-/ankerikoner, runde "porthole"-rammer om avatarer og datoer, eventuelt en subtil bølgelinje.
* **Ikke** en piratside. Temaet er krydderi, ikke hovedret.
* **Ingen lilla** som primær- eller accentfarve.

## 13.2 Farver [BESLUTNING, D-092]

| Token | Rolle | Værdi |
|---|---|---|
| `olive` (`--primary`) | Primærfarve (Jespers valg): app-rammen (sidebar, top bar, bundnavigation, login/onboarding-båndet, toasts) og handlinger (primærknapper, links, aktive og valgte tilstande, bekræftede events i kalenderen). Overskrifter. | `#414437` |
| `olive-soft` | Hover og aktivt punkt på app-rammen | `#525742` |
| `olive-deep` | Hover på primærknap, klubbadge, succes-tekst | `#2D2F23` |
| `olive-tint` | Lys oliven: events i månedsgitteret, succes-beskeder | `#E3E8CE` |
| `on-dark-muted` | Dæmpet tekst på olive- og harbor-flader | `#CECFC4` |
| `harbor` | Sekundærfarve (havneblå) i en støtterolle: Overblikkets hero-kort, "Klubbens rating", eventsidens anker, "i dag" i kalenderen, info-badges og info-beskeder | `#3E5568` |
| `harbor-soft` / `harbor-tint` | Flader på harbor-kort / lys info-baggrund | `#4E6679` / `#DCE6EE` |
| `cream` | Baggrund, varm off-white | `#F6F0E1` |
| `paper` | Kort og felter | `#FFFBF3` |
| `amber` | Accent: stjerner, highlights, "I aften!", messingknap, fokusring på mørke flader | `#D99A1E` |
| `amber-ink` / `brass` | Amber som tekst/stjerner på lyse flader / fokusring på lyse flader | `#8A5A00` / `#A06A0A` |
| `ink` | Tekst | `#1A1D21` |
| `slate` | Sekundær tekst | `#5E6670` |
| `danger` | Destruktive handlinger | `#B3261E` |

Afledte nuancer (`cream-deep`, `sand`, `amber-light`, `amber-tint`, `danger-deep`, `danger-tint`) og avatarfarverne (olive, harbor, rust `#8A3B2E`, brown `#7A4A12`, slate) står i `src/app/globals.css`.

* Alle tekst/baggrund-kombinationer opfylder **WCAG AA** (4,5:1 for tekst, 3:1 for ikoner, UI-kanter og fokus).
* Amber giver kun 4,08:1 på olive og 3,18:1 på harbor. Den bruges derfor kun til ikke-tekst på mørke flader (ikoner, stjerner, fokusring). Tekst på amber er `ink` (6,92:1), og amber-tekst på harbor er `amber-light` (4,76:1).
* **Ingen lilla.** Tailwinds standardpalet er slået fra (D-032).
* [SENERE] Mørkt tema (oliven baggrund), som passer naturligt til universet og til dårligt lys under smagninger.

> v1 af paletten (navy `#13233F` + flaskegrøn `#0B6B3A`, "fra øltrøjen") er erstattet af D-092.

## 13.3 Typografi (forslag)

* **Overskrifter:** en karakterfuld serif eller slab (fx *Fraunces* eller *Zilla Slab*). Giver "etiket"-følelse.
* **Brødtekst/UI:** en læsbar sans-serif (fx *Inter* eller *Source Sans 3*).
* Store datoer på events ("23 / OKTOBER") er et gennemgående visuelt motiv.

## 13.4 UI-principper

1. **Store events.** Events skal have plads. Ingen små kalenderbokse med ulæselig tekst.
2. **Visuelt hierarki:** næste event → afstemninger → kommende events → praktisk info → historik.
3. **Kort frem for tabeller.** Øl, events og sange vises som cards/list items.
4. **Mobile first.** Design til 375 px bredde først. Trykflader på mindst 44×44 px.
5. **Én primær handling pr. skærm** er tydeligt fremhævet.
6. **Optimistisk UI** ved hurtige handlinger (rating, stemme, ejer-toggle) med rollback ved fejl.
7. **Skeletons** frem for spinnere ved indlæsning.

## 13.5 Mikrotekst-eksempler

| Situation | Tekst |
|---|---|
| Stemme gemt | "Skål! Din stemme er gemt ✓" |
| Ingen events | "Ingen kommende ølsmagninger endnu 🍺" |
| Tomt katalog | "Kataloget er tomt. Hvad drak I sidst?" |
| Rating gemt | "Gemt ✓" |
| 404 | "Den her øl er vist drukket. Siden findes ikke." |
| Generisk fejl | "Noget gik galt – prøv igen. Vi har tørret disken af." |
| Tom sangbog | "Sangbogen er tom endnu 🎵" |
| Ingen sange fundet | "Ingen sange matcher „…“" / "Prøv et enkelt ord fra titlen eller en linje, du kan huske." |
| Søgning uden æ/ø/å | "Ingen præcise træf. Her er sange, hvis man ser bort fra æ, ø og å." |
| Sang tilføjet / slettet | "Sangen er tilføjet 🎵" / "Sangen er slettet." |
| Slet sang | "Slet «Titel»?" / "Sangen forsvinder fra sangbogen for alle i klubben. Det kan ikke fortrydes." / [Behold den] |
| Afstemning oprettet | "Afstemningen er klar 🗳 Del linket med klubben." |
| Stemme gemt og afstemningen lukket | "Skål! Din stemme er gemt ✓ Alle har stemt, og eventet er oprettet 🎉" / "… Alle har stemt – men der er uafgjort 🤝" |
| Ugemte kryds | "Ikke gemt endnu" |
| Stemmesedlen | "Du kan stemme indtil {frist} – og ændre det bagefter." / "Du har stemt ✓ Du kan ændre din stemme indtil {frist}." |
| Åbne stemmer | "Stemmerne er åbne: alle i klubben kan se, hvem der har stemt på hvad." |
| Intet at stemme om | "Tilføj mindst to datoer eller to steder, så der er noget at stemme om. Ligger alt fast, så opret et event i stedet." |
| Afstemning lukket | "Afstemningen er lukket 🔒" / "🎉 Afstemningen er afsluttet, og eventet er oprettet!" / "Afstemningen er lukket – der er uafgjort 🤝" |
| Vinder valgt / annulleret | "🎉 Vinderen er valgt, og eventet er oprettet!" / "Afstemningen er annulleret." |
| Rediger afstemning | "Ingen har stemt endnu, så du kan stadig rette datoer og steder. Når den første stemme er afgivet, ligger de fast." / "Datoer og steder kan ikke ændres, når nogen har stemt. Er de forkerte, så annullér afstemningen og start en ny." / "Nogen har stemt i mellemtiden, så datoer og steder kan ikke længere ændres. Intet er gemt." (D-153) |
| Afslut nu | "Afslut afstemningen nu?" / [Afslut nu] / [Fortsæt afstemningen] |
| Annullér | "Annullér «Titel»?" / "Der bliver ikke oprettet et event. Stemmerne bliver stående, så I kan se dem." / [Behold den] |
| Uafgjort | "Der er uafgjort om stedet 🤝" / "Ingen nåede at stemme 🦗" / "Mads valgte stedet, da det stod lige." |
| Hvem styrer | "Mads (opretteren) og klubbens admins kan afslutte eller annullere afstemningen." / "Kun opretteren og klubbens admins kan …" (D-117) |
| Event fra afstemning | "Valgt ved afstemning 🗳" / "Eventet fra afstemningen er slettet." |
| Feedback gemt / rettet / slettet | "Tak! Din rapport er gemt 🍻" / "Gemt ✓" / "Rapporten er slettet." |
| Feedback-status gemt (app-admin) | "Status er gemt ✓" |
| Ingen rapporter | "Ingen åbne rapporter. Skål!" / "Ingen lukkede rapporter endnu." / "Du har ikke sendt nogen rapporter endnu." |
| Slet rapport | "Slet rapporten?" / "Rapporten og dens 👍 slettes. Det kan ikke fortrydes." / [Behold den] |
| 👍 på feedback | "👍 Jeg har også det problem" / "👍 Det vil jeg også gerne have" / "Fjern min 👍" / "Din rapport tæller automatisk som 1 👍" |
| Lignende rapporter | "Findes den allerede?" / "Giv hellere en 👍 på en rapport, der findes, end at skrive den igen." |
| Fejlside | [Prøv igen] [Rapportér denne fejl] |
| Skift email | "Du logger ind med den nye email fra nu af. Dine andre enheder bliver logget ud." / "Din email er skiftet. Dine andre enheder er logget ud." / "Den email bruges allerede af en anden konto." / "Det er allerede din email." / "De to emails er ikke ens." |
| Email på en Google-konto | "Du logger ind med Google, så din email følger din Google-konto." |
| Tilføj password | "Vælg et password, så du også kan logge ind med email." / [Gem password] / "Dit password er gemt. Nu kan du også logge ind med email og password. Dine andre enheder er logget ud." |
| Tilføj password, login for gammelt | "Af sikkerhedshensyn skal du have logget ind med Google for nylig, før du kan tilføje et password." / [Log ind med Google igen] / "Log ind med Google igen for at tilføje et password." |
| Synlighed | "ⓘ Din rapport kan ses af alle brugere af appen." |

---

# 14. Komponenter

Genanvendelige og generiske nok til flere steder. Navne på engelsk.

**Primitiver (`components/ui`)**
`Button`, `IconButton`, `Input`, `Textarea`, `Select`, `DateTimePicker`, `Card`, `Modal`, `ConfirmDialog`, `Toast`, `Skeleton`, `EmptyState`, `ErrorState`, `Avatar`, `Badge`, `Tabs`

**Feature-komponenter (`components/features`)**

| Komponent | Bruges i |
|---|---|
| `ClubSwitcher` | Top bar / sidebar |
| `AppShell` (`BottomNav`, `Sidebar`) | Alle klubsider |
| `NextEventHero` | Overblik |
| `EventCard` / `EventListItem` (valgfri `meta`, `muted`, `showPlace`) | Overblik, Kalender, historik, steders side |
| `CalendarMonth` / `CalendarList` | Kalender |
| `EventForm` | Opret/rediger event |
| `HostsPicker`, `EventHosts` | EventForm, event detail |
| `PastEvents`, `CalendarHistory` | Overblik, Kalender ("Tidligere ølsmagninger") |
| `PlaceSelector` (med "＋ Nyt sted") | EventForm, PollForm |
| `PlaceCard`, `PlaceList`, `PlaceForm`, `PlaceOwners` (med ejer-toggle), `RemovePlaceButton`, `ArchivedPlaceBanner` | Steder |
| `MemberList`, `MemberActionsMenu`, `LeaveClubSection`, `DeleteClubDialog`, `ClubInfoForm` | Klubbens side |
| `ProfileIdentity`, `ProfileForm`, `ChangeEmailForm`, `ChangePasswordForm`, `SetPasswordForm`, `GoogleReauth` | Profil (D-151, D-152) |
| `GoogleSignIn` / `GoogleSignInButton` | Log ind, opret konto, "Log ind med Google igen" på Profil (D-152) |
| `useActionForm` + `FieldShell`, `InputField`, `PasswordField`, `TextareaField`, `CheckboxField`, `ChoiceFieldset` (`features/forms`, D-109) | Alle formularer med Server Actions |
| `BeerCard`, `BeerRating`, `RatingSummary` | Ølkatalog, event detail |
| `BeerForm` (med dublet-advarsel) | Tilføj øl |
| `SongbookBrowser`, `SongFinderBar`, `SongLetterGrid`, `SongAlphabetList`, `SongListItem`, `SongSearchResults`, `SongListSkeleton` | Sangbogens oversigt |
| `SongReader` (Wake Lock), `SongTextView`, `SongViewToggle`, `SongFontStepper`, `SongNeighboursNav`, `BackToSongbook`, `SongReaderSkeleton`, `SongbookPrefsScript` (rodlayoutet, D-124) | Læsevisning |
| `SongForm`, `SongPreview`, `SongFormatHelp`, `DeleteSongButton` | Opret/rediger sang (admin) |
| `PollCard` | Overblik |
| `PollOptionCard`, `PollOptionChip` (`CalendarItem` i `event-format.ts`) | Kalender (liste, dagspanel, månedsgitter) |
| `PollForm` (`PollDateRows`, `PollPlacePicker` med `PlaceChoiceCard type="checkbox"`, `PollDeadlineField`), `PollEditForm` | Planlæg ølsmagning, rediger afstemning |
| `PollHeader`, `PollVoteForm` (`DateVoteOption` checkbox, `PlaceVoteOption` radio, `FixedOptionRow`, `VoteBar`, `VoterAvatars`), `PollResults`, `VotingProgress`, `PollAutoRefresh` | Afstemningsside |
| `PollStatusPanel` (`PollOutcome`, `TieResolver`, `CancelledPollBanner`), `PollManageActions` (`ClosePollButton`, `CancelPollButton`) | Afstemningsside |
| `EventPollNote` ("Valgt ved afstemning 🗳") | Event detail |
| `PlanActions` ([ Opret event ] [ Planlæg ølsmagning ]) | Overblik |
| `getDisplayName()` (ingen egen komponent; `formatMemberName` på medlemslisten) | Overalt |
| `InviteShare` | Klubside (invitationskortet, D-163) |
| `FeedbackForm` (`FeedbackTypeChoice`, `SimilarFeedback` med lignende rapporter), `FeedbackCard`, `FeedbackStatusBadge`, `FeedbackFilters`, `UpvoteButton`, `DeleteFeedbackButton`, `FeedbackModerationForm`, `FeedbackMeta`/`FeedbackTechInfo`/`FeedbackAdminResponse` (`feedback-detail.tsx`), `FeedbackShell` (0 klubber), feedback-skeletons | Feedback (`src/components/features/feedback/`) |
| `ReportErrorLink` ("Rapportér denne fejl") | Fejlgrænserne (`error.tsx` i roden, klubben og feedback; `global-error.tsx` har et almindeligt `<a>`) |
| `FeedbackLink` (i `profile-links.tsx`) | Profil |

---

# 15. Kvalitetskrav

## 15.1 Definition of Done (pr. feature)

En feature er først færdig, når:

* [ ] UI er implementeret og følger designsystemet.
* [ ] Loading state findes (skeleton).
* [ ] Empty state findes, hvis relevant.
* [ ] Error state findes med en handlingsrettet besked.
* [ ] Input valideres med Zod **på serveren** (og i formularen).
* [ ] Autorisation håndhæves på serveren (membership + ressource-rettighed).
* [ ] Club isolation er verificeret (ressourcer fra anden klub giver 404).
* [ ] Destruktive handlinger kræver confirmation.
* [ ] Mobil-layout fungerer (375 px) og desktop-layout fungerer.
* [ ] Data gemmes korrekt, og refresh mister ikke state.
* [ ] Fungerer for almindelige medlemmer, admins og relevante edge cases (§12).
* [ ] Domænelogik har unit tests.
* [ ] `tsc --noEmit`, lint og tests er grønne.
* [ ] Status er opdateret i §19.2.

## 15.2 Tilgængelighed

Semantisk HTML, synlige focus-states, labels på alle inputs, tastaturbetjening af rating og stemmer, `prefers-reduced-motion` respekteres og WCAG AA-kontrast.

## 15.3 Tests – minimum

* **Unit (Vitest):** `tallyPoll` (entydig vinder, uafgjort, 0 stemmer, én valgmulighed, flere datokryds pr. person, "ingen passer"), `isBallotComplete`, `shouldAutoClose`, "mindst én admin"-reglen (fjern, nedgradér, forlad), rating-gennemsnit og -konvertering, `getDisplayName`, alle `can*`-rettighedsfunktioner, invitationskode-normalisering, dato-formatering omkring sommertid, fjernelse af klub-id fra feedback-sti, `isAppAdmin`.
* **Integration:** Server Actions afviser ikke-medlemmer, ressourcer fra andre klubber og stemmer efter deadline. Kun app-admin kan ændre feedback-status og se teknisk info. Samtidig lukning giver ét event.
* **E2E (Playwright), kritiske flows:** signup → opret klub → opret event → ser det på Overblik. Join via link. Rate øl. Afstemning hele vejen til oprettet event.

## 15.4 Kodestandard

* TypeScript `strict: true`. Ingen `any` uden kommentar med begrundelse.
* Små komponenter. Over ca. 200 linjer bør komponenten splittes.
* Database-constraints beskytter invarianter. App-tjek er ekstra, ikke en erstatning.
* Migrations committes. Ingen manuelle databaseændringer.

---

# 16. MVP og implementeringsrækkefølge

## 16.1 MVP-scope

| Område | Med i MVP |
|---|---|
| **Auth** | Email/password, Google, glemt password, profil |
| **Klubber** | Opret, join (kode + link), flere klubber, klubvælger, medlemsliste, roller (Admin/Member), forlad, slet |
| **Events** | Opret, rediger, slet, detail (inkl. øl smagt), Overblik, Kalender (liste + måned) |
| **Steder** | Opret, rediger, ejer-toggle, arkivering, vælg til events |
| **Ølkatalog** | Tilføj, se, søg, sortér, filtrér, rate (halve point), gennemsnit, relatér event, dublet-advarsel |
| **Sangbog** | Se (alfabetisk), søg (titel, kunstner, melodi, tekst), læsevisning med akkorder, admin-CRUD, import af eksisterende sangbog |
| **Afstemninger** | Dato (kryds ved alle der passer) + sted (én stemme), frist, ændr stemme, åbne live-resultater, luk manuelt/ved frist/alle stemt, uafgjort-håndtering, automatisk event |
| **Settings** | Navn, kælenavn, email, password (D-106, D-151, D-152) |
| **Feedback** | Rapportér fejl, foreslå feature, se alle rapporter, filtrér, 👍, status og svar fra app-admin |

## 16.2 Rækkefølge

Voting kommer bevidst efter events og steder, fordi den afhænger af begge.

```text
 M0  Fundament
     1. Projektopsætning (Next.js, TS strict, lint, Prisma, Tailwind, shadcn/ui)
     2. Designsystem: tokens, typografi, AppShell, primitiver
     3. Seed-script med testdata

 M1  Adgang
     4. Authentication (email/password, Google, glemt password)
     5. User + Club + Membership + roller
     6. Onboarding, invitationer, join-link
     7. Klubvælger + routing-logik (§10.1)
     8. getDisplayName + kælenavn (tidligt, fordi det bruges overalt)

 M2  Kalenderkernen
     9. Steder (nødvendige for events)
    10. Events (CRUD + detail + værter)
    11. Overblik
    12. Kalender

 M3  Klubbens hukommelse
    13. Ølkatalog
    14. Ratings
    15. Sangbog + import af eksisterende sangbog

 M4  Planlægning
    16. Afstemninger (oprettelse + stemmer + resultater)
    17. Lukning, optælling, uafgjort, automatisk event, cron

 M5  Færdiggørelse
    18. Profil/klubindstillinger (resten)
    19. Feedback (fejl og ønsker)
    20. Polish, tilgængelighed, E2E-tests, deploy
```

> Ændring fra v1: **Steder er flyttet før Events**, fordi event-formularen kræver et sted. **Kælenavn/visningsnavn er flyttet tidligt**, fordi alle sider viser brugernavne.

> **Erstattet 2026-10-08 (D-020):** Rækkefølgen M0–M5 ovenfor er erstattet af de fire implementeringsrunder i §16.3. Indholdet af de enkelte features (§6–§9) gælder stadig.

## 16.3 Implementeringsrunder [BESLUTNING, D-020]

Appen bygges iterativt i fire runder. Hver runde udvider den eksisterende app og efterlader en **deploybar, brugbar og testet** version. AI-agenten arbejder **én runde ad gangen** og implementerer kun funktioner, der hører til den aktuelle runde. Fremtidige features bygges ikke "for en sikkerheds skyld", men arkitekturen må ikke forhindre dem.

Inden en ny runde påbegyndes: gennemgå eksisterende arkitektur, genbrug eksisterende komponenter og mønstre, kontrollér database-relationer, og test eksisterende funktionalitet efter ændringer. En senere runde må gerne udvide eksisterende features, men må ikke bryde det, der allerede virker.

### Runde 1 – "Vi har en klub" (fundament) ✅ 2026-10-08

* Projektopsætning, designsystem og AppShell (tidl. M0).
* Authentication: opret bruger, login, logout, Google, glemt password (§6). Uden email-opsætning bruges admin-genereret nulstillingslink (§6.4).
* Bruger: navn, email og basisprofil (redigér navn, billede fra Google).
* Klub: opret, join via kode/link (§7.2–7.3), medlemskab, rollerne Admin/Member (D-018, D-021), invitationslink + del + ny kode (admin), medlemsliste (kun visning).
* Flere klubber: routing efter §10.1, klubvælger (`/clubs`), `ClubSwitcher`, `lastActiveClubId`.
* Navigation: Overblik, Kalender, Øl, Sangbog, Profil. Kalender, Øl og Sangbog er placeholders.
* Overblik: "Velkommen til Ølklubben 🍺", "Ingen kommende events endnu." og [ Opret event ] (fører til en "kommer snart"-side). "Inviter medlemmer"-kort, når klubben kun har ét medlem.

**Definition of Done:** (a) Ny bruger: opret konto → opret klub → bliv Admin → se Overblik → log ud → log ind → lander automatisk i klubben. (b) Anden bruger: opret konto → åbn invitationslink → join → se klubben. Begge flows er dækket af E2E-tests.

### Runde 2 – "Vi kan faktisk bruge den" (events og øl) ✅ 2026-10-09

* Events: opret, redigér, slet, detail. Titel, dato, starttid (+ valgfri sluttid), **sted som fritekst** (D-022), tema, beskrivelse/plan, oprettet af.
* Overblik med `NextEventHero` og kommende events (§9.1).
* Kalender: liste + måned på mobil og desktop (§9.3).
* Ølkatalog: tilføj, se alle, detail, navn, alkoholprocent, valgfrit event, søgning, sortering (§9.5).
* Rating: egen rating (1–5, halve point), ændr, fjern, klubbens gennemsnit, antal ratings.

**Definition of Done:** opret event → se det på Overblik → se det i Kalender. Tilføj øl → knyt til event → rate → se klubbens gennemsnit.

### Runde 3 – "Det er vores klub" (identitet og historik) ✅ 2026-10-09

* Sangbog: oversigt, søgning, detail/læsevisning, opret og redigér (admin), import af eksisterende sangbog (§9.6). Genoptaget 2026-10-13: Jesper har leveret sangbogen (D-118, erstatter D-091). ✅ 2026-10-13
* Profil: kælenavn, profilbillede, `getDisplayName()` overalt, skift password (§9.8, D-105, D-106).
* Steder som egen datamodel: opret, redigér, slet/arkivér, gendan, se, ejere (flere), sæt/fjern sig selv som ejer (§9.4, D-095, D-100).
* Events bruger `Place` i stedet for fritekst. Eksisterende fritekst migreres til steder (D-022, D-097). Værter udfyldes fra stedets ejere (D-098, D-099).
* Eventhistorik: tidligere events på Overblik og i Kalender, og pr. sted (D-107).
* Klubbens medlemmer (Q11): gør til admin, fjern admin-rollen, fjern medlem, forlad klub, slet klub og redigér klubinfo (§7.4, §7.5, D-102–D-104, D-110).

**Definition of Done:** appen fungerer som klubbens samlede arkiv: kommende og tidligere events, ølkatalog, sangbog, medlemmer og steder. (Sangbogen er med igen, D-118; den testes manuelt af Jesper, D-119.)

**Implementering (2026-10-09, D-094):** først TG-021 (fælles formularmotor, D-109), så ét fundament (skema, migrering, domæne, validering, datalag, interim-eventformular, alle nye ruter med endelige guards, seed), så tre parallelle agenter med eget filejerskab (A profil og medlemmer, B steder, C events med steder og historik) og til sidst en integrator. E2E for DoD: `e2e/round3-dod.spec.ts` (kælenavn → sted med ejer → events med værter → historik → arkivering → roller, forlad og slet klub).

### Runde 4 – "Vi kan planlægge sammen" (afstemninger) ✅ 2026-10-18

* Afstemninger efter §9.7: oprettelse (datoer, steder, frist), stemmer, ændr stemme, live-resultater, lukning ved frist / alle har stemt / manuelt, uafgjort med manuelt valg, automatisk event med værter fra stedets ejere, daglig cron som sikkerhedsnet.

**Definition of Done:** opret afstemning → medlemmerne stemmer → vindende dato og sted → et almindeligt event oprettes → det vises i Kalender og på Overblik. Uafgjort → opretter eller admin vælger vinder → event.

**Implementering (2026-10-14):** ét fundament (skema, migrering, låse, rene domænemoduler, validering, datalag med lukning og cron, alle ruter i endelig form, stubs med låste props, seed), så to parallelle agenter med eget filejerskab (P1 opret, ret og stem; P2 lukning, uafgjort, annullering, Overblik, Kalender og eventsiden) og til sidst en integrator (D-129–D-139). **Testomfang (Jesper, 2026-10-14: "stop før du starter end to end test"):** unit og integration er skrevet og kørt. E2E er skrevet, men ikke kørt: `e2e/round4-dod.spec.ts` (DoD), `e2e/polls.spec.ts`, `e2e/poll-lifecycle.spec.ts` og runde 4-delene af `e2e/club-isolation.spec.ts` (TG-053). Runden er ✅, når de er kørt grønt. **✅ 2026-10-18:** Jesper bad om hele E2E-testen (D-154); alle fire filer er kørt grønt i den fulde suite to gange i træk (214/214), og datoer og steder kan nu rettes, indtil den første stemme er afgivet (D-153).

### Prioritet ved nedskæring

**Must have:** auth, klubber + medlemskaber, events, Overblik, Kalender, ølkatalog, rating. **Should have:** sangbog, steder, kælenavn, historik. **Advanced:** afstemninger, voting, automatisk event-oprettelse.

Feedback (§9.9) indgår ikke i runderne (se Q10). Den bygges efter runde 4: først serveren (2026-10-16: datamodel, domæne, validering, datalag, actions, script og seed), så siderne, indgangene fra Profil og fejlsiderne og E2E (2026-10-18, D-147–D-150). ✅ 2026-10-18 sammen med "Skift email" og "Tilføj password" på Profil (D-151, D-152) og den fulde E2E-gennemgang (D-154). Dermed er hele MVP-scopet i §16.1 bygget; tilbage står kun [SENERE]-punkter (§17) det, der venter på SMTP, et domæne eller Google-credentials (TG-001, TG-011, TG-033), og den første deploy til Vercel + Neon (§16.2 punkt 20, TG-012).

---

# 17. Features til senere [SENERE]

Arkitekturen skal gøre disse mulige uden større omskrivninger:

* **RSVP** pr. event: ✅ Kommer / 🤷 Måske / ❌ Kommer ikke (ny tabel `EventRsvp`).
* **Notifikationer:** email/push ved ny afstemning, frist og nyt event.
* **PWA:** "Føj til hjemmeskærm", app-ikon og offline-visning af sangbog (sangbogen virker i dag kun online).
* **Kalendereksport:** .ics pr. event eller abonnementsfeed.
* **Udvidede øldata:** bryggeri, øltype, land, billede og personlige noter.
* **Favoritøl** og **favoritsange**.
* **Statistik:**
  * Personlig: antal øl rated, gennemsnitlig rating, "din strengeste/mildeste dom".
  * Klub: top 10, bund 10, mest populære øltype, mest aktive rater, antal øl og events, "mest uenige øl" (højeste spredning i ratings).
* **Billeder** på events.
* **Smagningstilstand:** fuldskærmsvisning under et event med hurtig tilføj-og-rate af øl.
* **Gamification:** badges (🏆 Første øl, 🍺 25 øl rated, 🍻 50 øl rated), kun hvis det passer til klubben.
* **Flere afstemningskategorier**, fx tema (datamodellen understøtter det).
* **Mørkt tema**, evt. først som natlæsning (mørk læsevisning i sangbogen).

---

# 18. Åbne spørgsmål

Disse skal afklares med Jesper. Indtil da gælder den markerede standard.

| # | Spørgsmål | Standard indtil videre |
|---|---|---|
| Q1 | Er resten af stacken OK (Prisma + Better Auth + Neon)? Hosting på Vercel er besluttet (D-016). | Som i §4.1 |
| ~~Q2~~ | ~~Kælenavn: pr. klub eller ét globalt?~~ | ✅ Afklaret 2026-10-04: **ét globalt** (D-011) |
| ~~Q3~~ | ~~Datoafstemning: én stemme eller kryds ved alle der passer?~~ | ✅ Afklaret 2026-10-04: **kryds ved alle der passer** (D-013) |
| ~~Q4~~ | ~~Skal man kunne se, hvem der stemte på hvad?~~ | ✅ Afklaret 2026-10-04: **fuldt åbent** (D-014) |
| ~~Q5~~ | ~~Sangbogen findes digitalt. Hvilket format, og hvordan er den struktureret (numre, melodi-angivelser)? Læg filen i `data/sangbog/`.~~ | ✅ Afklaret 2026-10-09: **59 ChordBank-udskrifter (PDF), én sang pr. fil**, uden numre og melodier, med den oprindelige kunstner og akkorder. Importeret med `npm run songbook:import` (§9.6, D-126). |
| Q6 | Tæller ratings fra tidligere medlemmer med i gennemsnittet? | Ja |
| Q7 | Hvad hedder appen/klubben, og findes der logo eller billede af øltrøjen (til farver)? | "Ølklubben", farver fra §13.2 |
| ~~Q8~~ | ~~Hosting og domæne?~~ | ✅ Afklaret 2026-10-04: **Vercel** (D-016), **intet eget domæne indtil videre**, appen kører på `*.vercel.app`. Email via Gmail SMTP (D-017). |
| Q9 | Må alle medlemmer dele invitationslinket, eller kun admins? | Alle må dele. Kun admins kan forny koden. |
| ~~Q10~~ | ~~Feedback (§9.9) er MVP i §16.1, men indgår ikke i de fire runder (§16.3). Hvornår skal den bygges?~~ | ✅ Afklaret 2026-10-08: **efter runde 4** (Jesper) |
| ~~Q11~~ | ~~Medlemsadministration (fjern medlem, gør til admin, fjern admin-rolle, forlad klub, slet klub, redigér klubinfo, §7.4–7.5) nævnes ikke i runderne. Hvornår?~~ | ✅ Afklaret 2026-10-08: **runde 3** under "Klubbens medlemmer" (Jesper) |
| Q12 | Skal admin-nulstillingslinks være endnu strammere, fx kun når email-levering ikke er sat op? Bivirkning af D-046: uden SMTP kan et medlem af to klubber uden fælles admin slet ikke nulstilles. | D-046 som den er. Når Gmail SMTP er sat op, er "Glemt password" vejen for dem. |
| ~~Q13~~ | ~~Skal email kunne ændres, før der er email-verificering og SMTP? Better Auth ville skifte emailen med det samme, uden password, og ignorere en email, der allerede er i brug.~~ | ~~Nej (D-106). Emailen vises kun. Se TG-033.~~ ✅ Afklaret 2026-10-18: **ja, for konti med password-login.** Udskydelsen var agenternes egen (D-106); de genvurderede den ud fra Jespers oprindelige §9.8/§16.1 ("Settings: Navn, kælenavn, email, password") og byggede en sikker variant uden Better Auths `changeEmail`: nuværende password, unik email, egen action (D-151). Bekræftelsesmail følger med SMTP og et domæne (TG-033). |

---

# 19. AI-agent: arbejdsområde

> Dette afsnit vedligeholdes af AI-agenten under implementeringen. Det er projektets hukommelse på tværs af sessioner.

## 19.1 Arbejdsregler for AI-agenten

1. **Læs før du bygger.** Læs de relevante afsnit af dette dokument og §19.2–19.5, før du går i gang med en opgave.
2. **Spec'en er kilden til sandhed.** Er implementeringen nødt til at afvige, så **opdatér spec'en** og skriv en linje i beslutningsloggen (§19.3). Spec og kode må ikke glide fra hinanden i stilhed.
3. **Log fejl og rettelser** i §19.4, når noget gik galt, en antagelse var forkert, eller en fejl tog mere end et par minutter at finde. Skriv det, så næste session ikke gentager fejlen.
4. **Opdatér status** i §19.2 efter hver afsluttet opgave.
5. **Stil spørgsmål i stedet for at gætte**, når noget er produktmæssigt uklart. Tilføj det til §18, og vælg en fornuftig standard, hvis du må fortsætte.
6. **Slet aldrig logposter.** Er en post forældet, markeres den `~~overstreget~~` med henvisning til den nye.
7. **Følg Definition of Done** (§15.1). En feature uden server-side autorisation er ikke færdig.
8. **Club isolation er ikke til forhandling** (§4.4).
9. Skriv dato i formatet `ÅÅÅÅ-MM-DD`.
10. **Sangbogens indhold er privat** (D-120). Rigtige sangtekster og titler kommer aldrig i repoet: ikke i kode, kommentarer, tests, fixtures, seed, README, SPEC, committede screenshots eller Artifacts. Tests og seed bruger opdigtede sange. Kør titel-grep'en (`git ls-files -co --exclude-standard | xargs grep -l -i -F -f <titelliste>`) ved hver gate. AI-agenter kører kun `songbook:import` mod lokale databaser (fjern-guarden kræver en TTY, D-126).

## 19.2 Implementeringsstatus

Status: ⬜ ikke startet · 🟨 i gang · ✅ færdig (opfylder DoD) · ⚠️ færdig med kendte mangler (se §19.5)

Organiseret efter implementeringsrunderne i §16.3 (D-020).

| Runde | # | Opgave | Status | Note |
|:-:|---|---|:-:|---|
| 1 | 1.1 | Projektopsætning (Next.js, TS strict, lint, Prisma, Tailwind, shadcn/ui, Vitest, Playwright) | ✅ | 2026-10-08. Next.js 16.4, Prisma 7.10, Better Auth 1.7.7, Zod 4, Tailwind 4, Vitest 5, Playwright 1.64. Se D-025, D-033. |
| 1 | 1.2 | Designsystem + AppShell (BottomNav, Sidebar, ClubSwitcher) | ✅ | 2026-10-08. Tokens efter §13.2 (WCAG AA tjekket), Zilla Slab + Source Sans 3, primitiver, `InviteShare`, `CenteredShell`. Se D-032. |
| 1 | 1.3 | Seed-script (runde 1-data: brugere, klubber, medlemskaber) | ✅ | 2026-10-08. Idempotent. 3 brugere (password `olklubben123`), 2 klubber, invitationer. Nægter produktion og ikke-lokale databaser uden `SEED_ALLOW_REMOTE=1` (D-050). Udvides i hver runde. |
| 1 | 1.4 | Authentication (email/password, Google, logout, glemt password) | ⚠️ | 2026-10-08. Alt bygget og testet. Google-login og rigtig SMTP er ikke testet end-to-end (mangler credentials), se TG-011. |
| 1 | 1.5 | User + Club + Membership + roller | ✅ | 2026-10-08 |
| 1 | 1.6 | Onboarding + invitationer + join-link | ✅ | 2026-10-08. Ventende invitation via `?next=` (D-051). |
| 1 | 1.7 | Klubvælger + routing (§10.1) | ✅ | 2026-10-08. `requireClubPage` (D-052). |
| 1 | 1.8 | Navigation + placeholders + første Overblik | ✅ | 2026-10-08 |
| 1 | 1.9 | Basisprofil + klubside (medlemsliste, invitation) | ✅ | 2026-10-08 |
| 1 | 1.10 | E2E for runde 1's Definition of Done | ✅ | 2026-10-08. 31 E2E-tests × desktop/375 px (62/62, grønne i flere kørsler i træk), 19 integrationstests (`npm run test:integration`), 282 unit tests. DoD (a)+(b) også gennemgået manuelt. |
| 2 | 2.1 | Events (CRUD + detail, sted som fritekst) | ✅ | 2026-10-09. Adversarial review gennemført (23 fund R2-01–R2-21, alle rettet). 524 unit, 64 integration, build, 98/98 E2E (49 tests × desktop/375 px) to kørsler i træk. DoD (a)+(b) og runde 1-stikprøver gennemgået manuelt ved 375 px. |
| 2 | 2.2 | Overblik (NextEventHero + kommende) | ✅ | 2026-10-09. Adversarial review gennemført (23 fund R2-01–R2-21, alle rettet). 524 unit, 64 integration, build, 98/98 E2E (49 tests × desktop/375 px) to kørsler i træk. DoD (a)+(b) og runde 1-stikprøver gennemgået manuelt ved 375 px. |
| 2 | 2.3 | Kalender (liste + måned) | ✅ | 2026-10-09. Adversarial review gennemført (23 fund R2-01–R2-21, alle rettet). 524 unit, 64 integration, build, 98/98 E2E (49 tests × desktop/375 px) to kørsler i træk. DoD (a)+(b) og runde 1-stikprøver gennemgået manuelt ved 375 px. |
| 2 | 2.4 | Ølkatalog | ✅ | 2026-10-09. Adversarial review gennemført (23 fund R2-01–R2-21, alle rettet). 524 unit, 64 integration, build, 98/98 E2E (49 tests × desktop/375 px) to kørsler i træk. DoD (a)+(b) og runde 1-stikprøver gennemgået manuelt ved 375 px. |
| 2 | 2.5 | Ratings | ✅ | 2026-10-09. Adversarial review gennemført (23 fund R2-01–R2-21, alle rettet). 524 unit, 64 integration, build, 98/98 E2E (49 tests × desktop/375 px) to kørsler i træk. DoD (a)+(b) og runde 1-stikprøver gennemgået manuelt ved 375 px. |
| 3 | 3.1 | Sangbog + import | ✅ | 2026-10-13. Bygget (D-118–D-128): datamodel med importfelter og 8 CHECKs, sangtekstformat med akkorder og danske etiketter, oversigt i dansk rækkefølge med A–Å, øjeblikkelig søgning i titel/kunstner/melodi/tekst med fallback uden æ/ø/å, læsevisning (Tekst/Akkorder, 7 skriftstørrelser, Wake Lock, forrige/næste), admin-CRUD med forhåndsvisning, importscript. De 59 sange er importeret i den lokale `olklubben_dev` (Drengene & Bajere); round trip 0 uenigheder på 3.988 linjer, ny kørsel 59 × UÆNDRET. TG-025 løst. **Test af sangbogen: Jesper manuelt (2026-10-13)** – ingen automatiske sangbogstests (D-119, TG-043); kun build og render-tjek (HTTP 200, ingen konsolfejl, ingen vandret scroll ved 375 og 1280 px, rigtige data). De eksisterende suiter er grønne: 724 unit, 197 integration, build, 150/150 E2E (75 tests × desktop/375 px). |
| 3 | 3.2 | Kælenavn + profilbillede + `getDisplayName` overalt | ✅ | 2026-10-09. Kælenavn 1–40 (D-105), visningsnavn overalt, profilens identitet med officielt navn, skift password (D-106). Fælles formularmotor først (D-109, TG-021). 9 integration (`round3-profile`), 3 E2E (`profile.spec.ts`). Hele runden: 724 unit, 197 integration, build, 150/150 E2E (75 tests × desktop/375 px) to kørsler i træk, DoD i `round3-dod.spec.ts`. Manuel gennemgang ved 375 og 1280 px som admin og medlem. Adversarial review (fase 4) følger. 2026-10-18: skift email og tilføj password til Google-konti (D-151, D-152), se rækken "Profil: skift email og tilføj password". |
| 3 | 3.3 | Steder + ejere + arkivering | ✅ | 2026-10-09. Liste (aktive + arkiverede), opret/rediger (navnedublet med link), stedets side med adresse og "Åbn i kort", ejere (optimistisk toggle, admin fjerner andre), "Opret event her", "Ølsmagninger her", én fjern-knap (slet ubrugt / arkivér brugt), gendan (D-095, D-100, D-115). 5 unit, 25 integration (`round3-places`), 6 E2E (`places.spec.ts`). Hele runden: 724 unit, 197 integration, build, 150/150 E2E (75 tests × desktop/375 px) to kørsler i træk, DoD i `round3-dod.spec.ts`. Manuel gennemgang ved 375 og 1280 px som admin og medlem. Adversarial review (fase 4) følger. |
| 3 | 3.4 | Events bruger `Place` + værter (migrering af fritekst) | ✅ | 2026-10-09. Migrering af fritekst til steder (D-097), sammensatte FK'er (D-096), stedvælger med "＋ Nyt sted" inline og værtsvalg (D-098, D-099, D-111–D-113), eventside med sted, adresse og værter (D-101). 21 unit (`event-form-state`), 75 integration (`round3-migration` 13, `round3-data` 41, `round3-events` 21), 4 E2E (`events-places.spec.ts`). Hele runden: 724 unit, 197 integration, build, 150/150 E2E (75 tests × desktop/375 px) to kørsler i træk, DoD i `round3-dod.spec.ts`. Manuel gennemgang ved 375 og 1280 px som admin og medlem. Adversarial review (fase 4) følger. |
| 3 | 3.5 | Eventhistorik | ✅ | 2026-10-09. "Tidligere ølsmagninger" på Overblik (3) og i Kalenderens liste (12, `?past=all`), "Ølsmagninger her" pr. sted (D-107, D-114). 3 E2E (`history.spec.ts`). Hele runden: 724 unit, 197 integration, build, 150/150 E2E (75 tests × desktop/375 px) to kørsler i træk, DoD i `round3-dod.spec.ts`. Manuel gennemgang ved 375 og 1280 px som admin og medlem. Adversarial review (fase 4) følger. |
| 3 | 3.6 | Medlemsadministration (Q11) | ✅ | 2026-10-09. '⋯'-menu pr. medlem (gør til admin, fjern admin-rollen, nulstillingslink, fjern), forlad klub, slet klub med skrevet navn, rediger klubinfo (D-102–D-104, D-110, D-116). 11 unit, 20 integration (`round3-members`), 5 E2E (`members.spec.ts`). Hele runden: 724 unit, 197 integration, build, 150/150 E2E (75 tests × desktop/375 px) to kørsler i træk, DoD i `round3-dod.spec.ts`. Manuel gennemgang ved 375 og 1280 px som admin og medlem. Adversarial review (fase 4) følger. |
| 4 | 4.1 | Afstemninger: oprettelse + stemmer | ✅ | 2026-10-14 (bygget, D-129–D-139), ✅ 2026-10-18. **E2E kørt 2026-10-18 (TG-053 løst):** `round4-dod.spec.ts` 6/6, `polls.spec.ts` 18/18, `poll-lifecycle.spec.ts` 16/16 og `club-isolation.spec.ts` 8/8 (desktop + 375 px); hele suiten 214/214 (107 tests × desktop/375 px) to kørsler i træk. Fejlene, E2E fandt, lå i testene, ikke i appen (F-080, F-081). 2026-10-18: datoer, starttid og steder kan rettes, indtil den første stemme er afgivet (D-153 erstatter D-133). 1093 unit (91 filer), 339 integration (15 filer, heraf 11 nye til D-153: 6 i `round4-polls-data`, 5 i `round4-poll-actions`), build grøn, drift-tjek tomt, render-tjek ved 375 og 1280 px. Opret med forslag (datoer, frist, titel), "＋ Nyt sted", ret (titel, tema, beskrivelse og senere frist; datoer og steder indtil første stemme), stem med forhåndsvisning og åbne stemmer, auto-opdatering. |
| 4 | 4.2 | Afstemninger: lukning, uafgjort, automatisk event, cron | ✅ | 2026-10-14 (bygget, D-129–D-139), ✅ 2026-10-18. **E2E kørt 2026-10-18 (TG-053 løst):** `round4-dod.spec.ts` 6/6, `polls.spec.ts` 18/18, `poll-lifecycle.spec.ts` 16/16 og `club-isolation.spec.ts` 8/8 (desktop + 375 px); hele suiten 214/214 (107 tests × desktop/375 px) to kørsler i træk. Fejlene, E2E fandt, lå i testene, ikke i appen (F-080, F-081). 2026-10-18: datoer, starttid og steder kan rettes, indtil den første stemme er afgivet (D-153 erstatter D-133). 1093 unit (91 filer), 339 integration (15 filer, heraf 11 nye til D-153: 6 i `round4-polls-data`, 5 i `round4-poll-actions`), build grøn, drift-tjek tomt, render-tjek ved 375 og 1280 px. Én lukkefunktion (sidste stemme, lazy close på Overblik/Kalender/afstemningssiden, manuelt, daglig cron `0 4 * * *` med `CRON_SECRET`), uafgjort → vælg vinder, annullér, event i samme transaction, PollCard, stiplede "Mulig dato", "Valgt ved afstemning 🗳", E5. |
| – | – | Feedback (fejl og ønsker; §16.2 punkt 19, §9.9) | ✅ | 2026-10-18. **Færdig: `feedback.spec.ts` 20/20 (10 tests × desktop/375 px) i den fulde E2E-suite, 214/214 to kørsler i træk.** Server (2026-10-16, D-141–D-146): datamodel med 9 CHECKs, `APP_ADMIN_EMAILS` valideret ved opstart, rent domæne, Zod-schemas, datalag med betingede skrivninger og rækkelåse, 5 Server Actions, 10 rapporter/døgn, `npm run feedback:list`, seed (4 rapporter). Sider (2026-10-18, D-147–D-150): `/feedback` med filtre i URL'en og tomme tilstande, `/feedback/new` med type, side (uden klub-id) og "Findes den allerede?", detaljesiden med 👍, ret/slet, teknisk info og status/svar/dublet for app-admin, `/feedback/[id]/edit`, skeletons, 404 og fejlgrænse; indgange fra Profil, footeren på sider uden klub og "Rapportér denne fejl" på fejlsiderne. 1056 unit (89 filer), 311 integration (14 filer), build grøn, render-tjek ved 375 og 1280 px som Jesper (app-admin) og Mads. `feedback.spec.ts` (10 tests × desktop/375 px) kørt alene: 20/20 grønne to gange, sammen med `profile`, `profile-and-deep-links`, `invites` og `multi-club` 58/58. Slutstatus 2026-10-18 (E2E-fasen): 1093 unit (91 filer), 339 integration (15 filer), build grøn, render-tjek af alle feedbacksider ved 375 og 1280 px som app-admin og som almindelig bruger (HTTP 200, ét h1, ingen vandret scroll). |
| – | – | Profil: skift email og tilføj password (§9.8, §16.1 "Settings") | ✅ | 2026-10-18. **Færdig: `profile.spec.ts` 10/10 og `form-focus.spec.ts` 2/2 i den fulde E2E-suite, 214/214 to kørsler i træk.** "Log ind med Google igen" er ikke kørt end-to-end, fordi Google ikke er sat op i dev og E2E (TG-011, TG-065). Agenternes udskydelse i D-106 er genvurderet ud fra §9.8/§16.1: "Skift email" for konti med password (ny email to gange + nuværende password, `verifyPassword`, unik email, `APP_ADMIN_EMAILS` afvist som "bruges allerede", lowercase og uverificeret, andre sessions og nulstillingslinks ryddes, D-151) og "Tilføj password" for rene Google-konti (Google-login under 10 minutter gammelt, ellers "Log ind med Google igen" med `loginHint`, D-152). Ingen migrering. 1077 unit (91 filer), 328 integration (15 filer, heraf 17 nye i `profile-account.itest.ts`), build grøn, render-tjek ved 375 og 1280 px som Mads og som en midlertidig Google-konto (frisk, forældet, REAUTH), ingen vandret scroll og ingen konsolfejl. |
| – | – | Fuld E2E-gennemgang af hele appen (Jesper 2026-10-16, D-154) | ✅ | 2026-10-18. Først de manglende MVP-features fra §16.1 (Feedback, skift email, tilføj password, ret datoer og steder før første stemme), så hele suiten: `npm run test:e2e` **214/214 (107 tests × desktop/375 px) to kørsler i træk, 0 fejlet, 0 flaky** (ingen retries lokalt). Pr. fil (desktop + mobil): beers 12, club-isolation 8, events-places 8, events 4, feedback 20, form-focus 2, history 6, invites 12, long-names 4, members 10, multi-club 8, overview-calendar 14, password-reset 10, places 12, poll-lifecycle 16, polls 18, profile-and-deep-links 12, profile 10, round1-dod 4, round2-dod 4, round3-dod 6, round4-dod 6, session 2, smoke 6. Første kørsel 213/214, anden 212/214: tre testfejl, ingen appfejl (F-081). En tredje kørsel blev ugyldig, fordi maskinen gik i dvale midt i den (F-082). Gates: `npm run check` (1093 unit, 91 filer), `npm run test:integration` (339, 15 filer), `prisma migrate status` up to date (6 migreringer), `npm run build` grøn, titel-grep 0 fund, render-tjek af de nye features ved 375 og 1280 px (28 sidevisninger: HTTP 200, ét h1, ingen vandret scroll). Sangbogen er stadig kun testet manuelt (D-119, TG-043). |
| – | – | Sikkerhedsopgradering: Next.js 16.4.0 → 16.4.2 (D-155) | ✅ | 2026-10-22. `next`, `@next/env` og `eslint-config-next` 16.4.2; `experimental.agentUpgrade: "security"` i `next.config.ts`. 16.4.0 var ramt af GHSA-p3m5-59mp-jv5r, GHSA-2464-fhr4-w9xw og GHSA-673q-mjm6-r5xr; `npm audit` melder ikke længere `next` (TG-005 genbesøgt). Gates i et rent miljø (F-083): `npm run check` (1093 unit, 91 filer), `npm run test:integration` (339, 15 filer), `next build` grøn, `npm run test:e2e` **214/214** (107 tests × desktop/375 px, 10,0 min, ingen retries), én kørsel. Titel-grep'en er ikke kørt (agentens adgang til sangtitlerne i databasen blev afvist); ændringen rører kun versioner, `next.config.ts` og SPEC. |
| – | – | Ren database + førstegangsoplevelse: login og PDF-import af sangbogen (D-156, D-157) | ✅ | 2026-10-24. Jesper nulstillede selv den lokale `olklubben_dev` (agentens TRUNCATE blev afvist af sikkerhedstjekket); `prisma/seed.ts` er urørt og kører kun med `npm run db:seed`. Login: emailfeltet har `autocomplete="username"`, så browseren foreslår gemte logins (D-157). Enter i loginformularen kunne ikke genskabes: i Chromium sender Enter samme request som et klik, og en E2E-kørsel (opret konto → log ud → skriv email og password → Enter) lander i klubben (F-084). Importér fra PDF i appen (§9.6, D-156): `unpdf` 1.8.1 (pdf.js) læser PDF'en på serveren, ChordBank-parseren er flyttet fra `scripts/songbook/` til `src/server/domain/songs/chordbank/` og deles med CLI'en, ren tekst for andre PDF'er, gennemsyn og ret, import i portioner. Tjek mod poppler på de 59 rigtige PDF'er (lokalt, intet committet): titel, kunstner og `sourceKey` ens for alle, teksten byte-identisk for 57; de 2 sidste afviger på én akkordlinje hver, hvor pdf.js placerer akkorden efter glyffens rigtige x. CLI'en læser stadig 59 sange, 0 FEJL, round trip 0 uenigheder. Tests (opdigtede PDF'er bygget i `tests/support/pdf.ts`): 11 unit (`pdf-text.test.ts`, `pdf-import.test.ts`), 4 integration (`song-import.itest.ts`), 4 E2E (`songs-import.spec.ts`, desktop + 375 px). Gates: `npm run check` (1104 unit, 93 filer), `npm run test:integration` (343, 16 filer), `next build` grøn (i en separat `NEXT_DIST_DIR`), titel-grep 0 fund. Fuld E2E: 210/218; de 8 fejl (6 i `beers`, 2 i `club-isolation`, alle desktop) stod på `/onboarding` efter "Opret ølklub" i begyndelsen af kørslen, mens dev-serveren kompilerede og agentens midlertidige screenshot-specs kørte mod samme server; kørt om alene: 20/20. |
| – | – | Billede af øllen (§9.5, D-158) | ✅ | 2026-10-24. Migrering `20261024120000_beer_images` (tabel, sammensat FK, 3 CHECKs), `sharp`-behandling, felt i øl-formularen med forhåndsvisning, skift og fjern, miniature på kortene, billede på øllens side, medlemsrute med 404 for alle andre. Tests: 1 unit (`removeImage`), 4 E2E (`beer-image.spec.ts`, desktop + 375 px): tilføjet fra eventets "+ Tilføj øl" med eventet valgt på forhånd, beholdt gennem serverens dublet-advarsel, 2400 × 1600 PNG gemt som 1200 × 800 WebP, 404 for en bruger uden for klubben, fjernet ved redigering; en fil, der ikke er et billede, giver feltfejlen. `npm run check` (1105 unit), `npm run test:integration` (343), fuld E2E **222/222** (111 tests × desktop/375 px, 7,4 min, ingen retries). |
| – | – | Login: tidligere brugte emails foreslås (D-157) | ✅ | 2026-10-24. Enter virker hos Jesper (F-084). Forslag: `src/lib/remembered-emails.ts` (ren, 4 unit), `use-remembered-emails.ts` (`useSyncExternalStore`), `<datalist>` i login og opret konto, "Brugt før:"-knapper på login. 2 E2E (`login-suggestions.spec.ts`, desktop + 375 px): knappen vises efter log ud, en afvist tastefejl huskes ikke, tryk udfylder og fokuserer password, Enter logger ind. |
| – | – | Log ud i sidebaren (§8.1, D-159) | ✅ | 2026-10-24. 1 E2E (`sidebar-logout.spec.ts`, kun desktop). `profile`, `session` og `login-suggestions` grønne med den rettede `logOut()`. |
| – | – | /simplify af dagens fire komponenter (D-160) | ✅ | 2026-10-24. 12 review-agenter (genbrug, forenkling, effektivitet, højde × PDF-import, billede af øllen, emailforslag) + Log ud gennemgået direkte. Rettet: fælles `sourceKeyOf`/`SOURCE_KEY_MAX_LENGTH` og `chordBankDraft` i `src/server/domain/songs/chordbank/` (CLI og app deler kernen), tidlig skrifttjek før ChordBank-parsen, `plainText` én gang pr. linje, skriftfamilie pr. `setFont`, validering memoiseret pr. sang i gennemsynet, fælles `SONGS_FORBIDDEN_MESSAGE` og "for stor"-tekst, døde re-exports og `PdfReadError.reason` fjernet; billedet behandles først efter dublettjekket, én `sharp`-instans, kortene henter en 112 px miniature (`?size=thumb`, laves i ruten) i stedet for hele billedet, browseren skalerer til 1200 px, `checkboxSchema` genbrugt, `BeerPhoto` (én `<img>`-undtagelse), `beerImageHref` tager `null`, fælles `imageVersionSelect`; ny `useAfterServerAnswer` i formularmotoren bruges af billedfeltet, F-053-eventvalget og `useCheckedAfterReset`; emailforslag via `emailSchema`, modul-cache + `storage`-event, `onValidSubmit` i `useActionForm`, `AuthField.suggestions`, chips som `Button` (44 px på touch) med revalidering. Sprunget over: sammensat PK/`content_type`-kolonne i `beer_images` (migreringen er allerede pushet), global `bodySizeLimit` (PDF-læsning i browseren eller egen Route Handler er en større ændring), klientens `importHash` (kun admins, harmløst), `Item` som discriminated union. Gates: `npm run check` (1108 unit), `npm run test:integration` (343), app mod CLI på de 59 PDF'er uændret (57 identiske), E2E for de berørte områder 37/37. |
| – | – | `fallow audit` af dagens ændringer (D-161) | ✅ | 2026-10-24. `npx fallow@3.35.0 audit --base 5055a15`: **fail → warn**. Rettet: `.fallowrc.json` med integrationstestene som entry points (fallow læser ikke `vitest.integration.config.mts`; alle `*.itest.ts` stod som ubrugte), ubrugt eksport (`SOURCE_KEY_PREFIXES`), duplikeret admin-guard (`requireSongAdminPage` i `src/server/songs/access.ts`) og øl-opslag (`requireBeer` genbrugt i `actions/beers.ts`), `test.skip` i `sidebar-logout.spec.ts` (mobil tjekker nu, at Log ud ikke er i bundmenuen), `readPdfRuns` (cyclomatic 46) delt i `TextState`, operator-tabel, `measure`, `appendRun` og `pageRuns` uden `eslint-disable`, `importSongs`/`readSongPdfAction` delt i hjælpere, importsiden delt i `use-song-pdf-import.ts`, `song-import-row.tsx` (Item som discriminated union) og `ImportFooter`/`PdfDropzone`, `AuthField`s datalist i `Suggestions`. Tilbage (advarsler): 17 CRAP-fund, der kun skyldes manglende coverage-data (cyclomatic ≥ 5 → CRAP ≥ 30; rå V8-coverage fra vitest kan fallow ikke koble til kilden), 6 Tailwind-værdier på flyttede linjer, `eslint-disable` i `BeerPhoto` (den ene begrundede `<img>`), og ældre fund uden for dagens ændringer (4 ubrugte UI-filer, 7 ubrugte eksporter). App mod CLI på de 59 PDF'er uændret (57 identiske). |
| – | – | Nyt mærke: to glas, der skåler, i koøjet (D-162) | ✅ | 2026-10-25. `LogoMark`, `icon.svg`, `apple-icon.png`. Tjekket ved 384, 64, 32 og 16 px og i sammenhæng på login (lg) og i sidebaren. |
| – | – | Klubsiden i sektioner, invitationskortet kun på Klubben, tynd skillelinje (D-163) | ✅ | 2026-10-25. `InviteSection` er nu Overblikkets kort (`invite-members-card.tsx` slettet), Overblik henter ikke længere medlemstal og kode (`countClubMembers` fjernet). `PollCard.quiet` og `NoEventsState.deemphasize` er fjernet. `RopeDivider` → `SectionDivider` (1px `bg-border`) på alle fem steder, `rope-line`/`wave-line` fjernet. Klubsiden: Medlemmer (kraftigere linje efter sidste admin) · Steder (h2 + "N steder") · invitationskortet · Farezone. E2E: `readInvitePath` læser linket fra klubsiden i en separat fane, når siden ikke viser det; round1-dod, overview-calendar og round3-dod rettet. Gates: typecheck, lint, 1108 unit, `fallow audit --base HEAD` kun advarsler, fuld E2E **226/226** (8,3 min, ingen retries). Screenshots af Overblik, Klubben (2 admins + 2 medlemmer) og Profil ved 1280 og 375 px gennemset. Hydration-advarslen `caret-color` på linkfeltet kom fra Playwrights screenshot (`caret: "hide"`) før hydration, ikke fra appen; med `caret: "initial"` ingen konsolfejl. |
| – | – | Invitationslinket pegede på et fejlet deploy: base-URL fra Vercel i produktion (D-164, F-085) | ✅ | 2026-10-26. `parseEnv().appBaseUrl`: `https://${VERCEL_PROJECT_PRODUCTION_URL}` på Vercel Production, ellers `BETTER_AUTH_URL`. 5 nye unit tests i `env-schema.test.ts`. Jesper skal fjerne `BETTER_AUTH_URL` fra Vercel Production og redeploye (loggen advarer, hvis den står der og er anderledes). |
| – | – | Google-login slået sikkert til uden Auth0 (D-165, F-086) | ✅ | 2026-10-26. Ingen automatisk kobling, "Forbind Google" på Profil, emailskift kobler Google fra, verificeret Google-email påkrævet, app-admin kræver bekræftet email, 5 endpoints lukket, id-token-login slået fra, tokens krypteret. Nyt: `google-oauth.itest.ts` (11 tests, rigtig Better Auth-handler, Googles token-endpoint mocket, mutationstestet). Gates: typecheck, lint, 1115 unit, 356 integration, fuld E2E. **Venter på Jesper:** Google Cloud-klienter og `GOOGLE_*` i Vercel Production (README "Google-login (OAuth)"), derefter manuel test (TG-011). |
| – | – | Auth0 Universal Login ved siden af email/password (D-166) | ✅ | 2026-10-28. `genericOAuth` + `auth0()`, eksterne logins gjort generelle, log ud via Auth0, `auth_time` til "Tilføj password". Nyt: `auth0-oauth.itest.ts` (19 tests med RS256-signerede tokens mod mocket JWKS) og `auth0-discovery.itest.ts`; 8 mutationer fanges hver af mindst én test. Gates: typecheck, lint, 1125 unit, 376 integration, fuld E2E. Lokal Auth0-app sat op (EU-tenant): dev-serveren registrerer Auth0 (discovery og JWKS), "Fortsæt med Auth0" sender til tenantens `/authorize` med `redirect_uri` `/api/auth/callback/auth0`, nonce og PKCE, og Universal Login viser Google og database. **Venter på Jesper:** login i browseren, produktionsapp i Auth0 med egen Google-klient og `AUTH0_*` i Vercel Production (README "Auth0-login"), derefter manuel test i produktion. |

## 19.3 Beslutningslog

Korte arkitektur- og produktbeslutninger. Nyeste nederst.

| ID | Dato | Beslutning | Begrundelse | Erstatter |
|---|---|---|---|---|
| D-001 | 2026-10-04 | Aktiv klub ligger i URL'en (`/c/[clubId]`) + `User.lastActiveClubId` | Refresh/deep links virker, flere faner muligt | – |
| ~~D-002~~ | 2026-10-04 | ~~Ejerskab af klub kun i `Membership.role` (ingen `Club.ownerId`), partial unique index~~ | Erstattet af D-018 | – |
| D-003 | 2026-10-04 | Rating gemmes som heltal 2–10 (halve point) | Undgår floating point, nem CHECK constraint | – |
| D-004 | 2026-10-04 | Steder arkiveres i stedet for at slettes, når de er i brug | Bevarer historik uden snapshot-felter | – |
| D-005 | 2026-10-04 | Én `PollOption`-tabel med `category` + composite FK fra `PollVote` | Regler pr. kategori bliver constraints, udvidelig | – |
| D-006 | 2026-10-04 | Event `date` + `time` samlet til `startsAt` (timestamptz), valgfri `endsAt` | Korrekt sortering og tidszoner | – |
| D-007 | 2026-10-04 | Afstemninger lukkes lazy + cron, idempotent via betinget UPDATE + unik `Event.pollId` | Ingen dobbelte events, ingen afhængighed af præcis job-timing | – |
| D-008 | 2026-10-04 | Uafgjort (inkl. 0 stemmer) → `AWAITING_DECISION`, opretter/admin vælger | Ingen tilfældige vindere (krav fra v1) | – |
| D-009 | 2026-10-04 | Vindende sted uden ejere → afstemningens opretter bliver vært | Et event skal altid have en ansvarlig | – |
| D-010 | 2026-10-04 | Event-beskrivelse er valgfri, nyt valgfrit felt "Tema" | Sænker friktion. Tema vises fremhævet på Overblik. | – |
| D-011 | 2026-10-04 | Ét globalt kælenavn (`User.nickname`) | Jespers valg (Q2). Enklest. Override pr. klub kan tilføjes senere. | – |
| D-012 | 2026-10-04 | Ressourcer fra andre klubber giver 404, ikke 403 | Afslører ikke eksistens | – |
| D-013 | 2026-10-04 | Dato stemmes med "kryds ved alle der passer" + "Ingen passer". Sted er én stemme. Datamodel: `PollBallot` + `PollVote`. | Jespers valg (Q3). Finder den dato, flest kan. | v1: én stemme pr. kategori |
| D-014 | 2026-10-04 | Stemmer er fuldt åbne (hvem stemte på hvad) | Jespers valg (Q4). Socialt i en lille klub. | – |
| D-015 | 2026-10-04 | Eksisterende sangbog importeres via script med dry-run | Sangbogen findes digitalt (Q5) | – |
| D-016 | 2026-10-04 | Deploy på Vercel (Hobby) + Neon Postgres via Marketplace, region `fra1`/`eu-central-1`. Daglig cron som sikkerhedsnet. | Jespers valg. Gratis, enkel deploy, data i EU. Se §4.8. | – |
| D-017 | 2026-10-04 | Intet eget domæne endnu (`*.vercel.app`). Email via Gmail SMTP bag et `sendEmail()`-interface + admin-genereret nulstillingslink som fallback. | Resend kræver verificeret domæne. Interfacet gør det nemt at skifte senere. | – |
| D-018 | 2026-10-04 | Kun to roller: **Admin** og **Member**. Opretteren af klubben bliver Admin. Flere ligestillede admins, altid mindst én (tjekkes i domænelaget med rækkelås). Alle admins kan slette klubben. | Jespers valg. Enklere model til en lille klub. | D-002 (Owner-rolle) |
| D-019 | 2026-10-04 | Feedback (fejl + ønsker) gemmes i appens database, er app-dækkende (ikke klub-specifik) og synlig for alle brugere. Status styres af app-admin via `APP_ADMIN_EMAILS`. | Jespers ønske. App-fejl er ikke klubdata, og én samlet backlog er nemmest. | – |
| D-020 | 2026-10-08 | Implementering i fire runder (§16.3), én runde ad gangen, hver runde deploybar og testet | Jespers implementeringsplan. Giver værdi tidligt og mulighed for at teste, før næste lag bygges. | Rækkefølgen i §16.2 |
| D-021 | 2026-10-08 | "Club owner" i runde-planen betyder Admin-rollen. Der indføres ingen ejer-rolle. | D-018 gælder stadig. Den, der opretter klubben, bliver Admin. | – |
| D-022 | 2026-10-08 | Runde 2: eventets sted gemmes som fritekst (`Event.locationText`). Runde 3: `Place` indføres, fritekst migreres til steder (ét pr. unik tekst pr. klub), og nye events vælger et sted. **Gennemført i runde 3 (D-097).** | Runde-planen bygger events før steder. Afviger midlertidigt fra §9.2. | – |
| D-023 | 2026-10-08 | Fanen "Profil" er klub-scopet (`/c/[clubId]/profile`) og samler basisprofil, link til Klubben og log ud. `/profile` sender videre dertil via `lastActiveClubId`. | AppShell og aktiv klub bevares på alle faner. Planens "Settings" svarer til Profil (§8.1). | – |
| D-024 | 2026-10-08 | Uden SMTP-opsætning skriver development (ikke produktion) emails til en lokal dev-outbox, så glemt password kan testes lokalt og i E2E. I produktion uden SMTP gælder §6.4. | Gmail-kontoen er ikke sat op endnu. | – |
| D-025 | 2026-10-08 | Next.js' `cacheComponents` (og `partialPrefetching`) er slået fra i `next.config.ts` | Med dem slået til fejler alle sider, der læser cookies/database uden `<Suspense>`, og det passer dårligt til en app, hvor alle sider kræver login. Skal genovervejes før Next 17. | – |
| D-026 | 2026-10-08 | UUIDv7-tekst-id'er overalt. Tabeller og kolonner i snake_case via `@map`. | Ugyldige id'er giver aldrig en databasefejl, og id'er kan sorteres efter tid. | – |
| D-027 | 2026-10-08 | Én aktiv invitation pr. klub håndhæves med et partielt unikt index via Prismas preview `partialIndexes` | Et rå SQL-index ville blive droppet af næste `prisma migrate dev`. | – |
| D-028 | 2026-10-08 | Auth-rate limiting i Better Auth `hooks.before` med egen database-limiter (`app_rate_limits`). Generøse grænser (fx login 30/5 min pr. IP og 10/15 min pr. email). | Better Auths `customRules` dækker ikke `auth.api.*`-kald fra Server Actions. Grænserne er generøse, fordi en hel klub kan dele én bar-wifi. | – |
| D-029 | 2026-10-08 | ~~Google-linking (§6.2) kræver, at Google rapporterer emailen som verificeret. `requireLocalEmailVerified = false`, ingen `trustedProviders`.~~ (Linking-delen erstattet af D-165: ingen automatisk kobling.) Email/password-konti verificerer ikke email. Better Auth er låst til 1.7.7. | Email/password-konti verificerer ikke email, så Better Auths standard ville blokere al linking. Optionen er deprecated, se TG-003. | D-165 |
| D-030 | 2026-10-08 | Sessions varer 60 dage og forlænges dagligt. Nulstilling af password logger ud overalt. Nulstillingslinks har formen `/reset-password?token=…` (også det admin-genererede), og tokens gemmes hashet. | Sjældent brug (§1.1) gør lange sessions venlige. Ét linkformat til både email og admin-link. | – |
| D-031 | 2026-10-08 | "Glemt password"-mailen sendes efter svaret (Next `after()` via Better Auths background tasks) | Svartiden afslører ikke, om emailen findes. E2E skal derfor polle dev-outboxen. | – |
| D-032 | 2026-10-08 | Typografi: Zilla Slab (overskrifter) + Source Sans 3 (UI). Tailwinds standardfarvepalet er slået fra, så kun brand-tokens findes. | Begge skrifter står blandt forslagene i §13.3. Slået-fra palet håndhæver "ingen lilla" og konsistens. | – |
| D-033 | 2026-10-08 | Env indlæses via `@next/env` overalt (Next, Prisma CLI, scripts, Playwright). `.env.test` committes (kun testværdier). E2E kører `next dev` på port 3100 mod `olklubben_test` (`NEXT_DIST_DIR=.next-e2e`), som tømmes (TRUNCATE) før hver kørsel. | Samme indlæsningsrækkefølge alle steder. Prisma 7 nægter `migrate reset` fra AI-agenter. Dev-serveren bevarer dev-outboxen (D-024). | – |
| D-034 | 2026-10-08 | Ekstra CHECK-constraints i databasen (navn-længder, email i lowercase, invitationskodens format) | §15.4: database-constraints beskytter invarianter. | – |
| D-035 | 2026-10-08 | Ekstra rate limits: opslag af invitationskode, mens man er logget ind (`join:lookup:user`, 30/10 min, fordi siden viser klubnavnet), selve join (`join:user`) og oprettelse af klub (`club:create:user`, 10/time) | Forhindrer gætning af koder og misbrug. Grænserne er så høje, at almindelig brug ikke rammer dem. | – |
| D-036 | 2026-10-08 | **Hver side under `/c/[clubId]` kalder selv `requireMembership(clubId)`**, ikke kun layoutet | Next kører ikke layoutet igen ved klientnavigation mellem sider i samme klub. Uden det ville et fjernet medlem ikke få 404 (E16). Kaldet er cachet pr. request. **Gælder alle fremtidige klubsider.** Udvidet af D-052 (`requireClubPage`). E16 = klubbens 404 med et link til forsiden. ~~Genbesøges i 3.6 (Forlad klub).~~ Afklaret i runde 3: forlad og slet sender til forsiden fra en ucachet klubliste (D-104), E15 og E16 er dækket af tests. | – |
| D-037 | 2026-10-08 | Footeren "Logget ind som … · Log ud" vises på `/onboarding`, `/clubs` og logget-ind `/join`-sider | En bruger uden klubber har ellers ingen måde at logge ud på, fordi "Log ud" ligger på den klub-scopede Profil (D-023). | – |
| D-038 | 2026-10-08 | Én generisk fejltekst overalt: "Noget gik galt – prøv igen. Vi har tørret disken af." (§13.5) | Konsistens. Ingen dublerede konstanter. | – |
| D-039 | 2026-10-08 | Runde 1 formaterer datoer med `Intl` via `formatToParts` (`src/lib/format/date.ts`, Europe/Copenhagen). date-fns + @date-fns/tz (§4.1) indføres først, når der er brug for dem (fx kalenderberegninger i runde 2). | Node/ICU giver "18.30" og varierende ugedagsformater. Strenge bygget af dele giver ens output på server og klient. | – |
| D-040 | 2026-10-08 | `/join/<kode>` med ugyldigt format viser E18 også for logget-ud brugere. En tilbagekaldt kode viser E18, selv for eksisterende medlemmer (ikke E17). | Formatet afslører intet om klubber. Tjekket for aktiv kode kommer før medlemskabstjekket. Logget-ud brugere ser en generisk invitation for alle velformede koder. E18 afgøres først efter login/signup, så der ikke findes et uautentificeret orakel for gyldige koder. | – |
| D-041 | 2026-10-08 | Klubsiden viser medlemmer først og derefter invitationen. Admins har en nøgleknap pr. medlem til nulstillingslink. **Nøgleknappen er erstattet af '⋯'-menuen (D-102).** | Medlemslisten er sidens primære indhold. I runde 3 kan knappen blive til en "⋯"-menu (fjern/gør til admin). | – |
| D-042 | 2026-10-08 | Auth-sider: vis/skjul-knap på password, Google-knappen over email-formularen, `referrer: no-referrer` på nulstillingssiden. Formularerne virker uden JavaScript (Server Actions + `useActionState`). | Mobilbrug under dårlige forhold (§1.1). Tokenet i URL'en må ikke lække via referrer. | – |
| D-043 | 2026-10-08 | Uden email-levering afvises `POST /request-password-reset` med 400 `EMAIL_DELIVERY_UNAVAILABLE`. `/reset-password` er stadig åben, så admin-links virker. | Undgår forældreløse tokens og fejllogs i produktion uden SMTP (§6.4). | – |
| ~~D-044~~ | 2026-10-08 | ~~Runde 1-Overblikkets h1 er "Velkommen til Ølklubben 🍺". Tom tilstand (h2): "Ingen kommende events endnu." (§16.3-ordlyd). Ved ét medlem vises invitationskortet først. ~~ Erstattet af D-077 | Korrekt overskriftsrækkefølge. Ordlyden samordnes med §9.1 i runde 2, når der kommer rigtige events. | – |
| D-045 | 2026-10-08 | Alle app-forbindelser (app, seed, E2E, integrationstests) sætter `TimeZone=UTC` via `pgConfig()` (`src/server/db/pg-config.ts`). Ingen database-indstilling kræves. Neons `-pooler`-host får ingen startup-option. | `@prisma/adapter-pg` antager en UTC-session (F-012). PgBouncer kan afvise startup-parametre, og Neon kører UTC. | – |
| D-046 | 2026-10-08 | Admin-nulstillingslink kun til medlemmer, hvis klubber *alle* administreres af admin'en, og aldrig til konti med Google-login. Afvisningen er generisk. UI'et er uændret. | Linket nulstiller hele kontoen. Ellers kunne en admin i én klub overtage kontoen hos et medlem af andre klubber, og Better Auth ville oprette et password-login på en Google-konto. En skjult knap ville afsløre medlemskab af andre klubber. Se Q12. | – |
| D-047 | 2026-10-08 | Et nyt admin-link ugyldiggør det forrige. En gennemført nulstilling ugyldiggør alle udestående links. "Glemt password" rydder bevidst ikke. | Ellers forblev ældre tokens gyldige i op til 1 time. Hvis "Glemt password" ryddede, kunne alle, der kender emailen, annullere et link. | – |
| D-048 | 2026-10-08 | `users.image` accepterer kun `null` eller en https-URL på `(*.)googleusercontent.com` | Forhindrer tracking-pixels for alle i klubben. Runde 1 har kun billeder fra Google (§9.8). | – |
| D-049 | 2026-10-08 | Glidende sessions (D-030) forlænges fra en Route Handler: `<SessionRefresh/>` renderer `<SessionKeepAlive/>`, når forlængelse er tid, og den kalder `/api/auth/get-session`. `getSession()` i Server Components bruger `disableRefresh`. | Server Components kan ikke sætte cookies. Før blev kun databaserækken forlænget, ikke cookien. | – |
| D-050 | 2026-10-08 | Seed nægter `NODE_ENV`/`VERCEL_ENV=production` og ikke-lokale databaser, medmindre `SEED_ALLOW_REMOTE=1` er sat (kun til en Neon dev-branch) | Testdata må aldrig ende i produktion. | – |
| D-051 | 2026-10-08 | "Ventende invitationskode" (§6.5, §10.1) implementeres som en valideret `?next=` (ikke en cookie). Den bæres gennem login, signup, Google (`callbackURL`), glemt/nyt password og "Log ud" på join-siden. Admin-links bærer aldrig `next`. | Mailapps åbner links i andre browsere, så en cookie ville gå tabt. Det er stateless og simpelt. | – |
| D-052 | 2026-10-08 | `requireClubPage(clubId)` = `requireMembership` + husk aktiv klub. Kaldes af alle klubsider. Layouts skriver aldrig til databasen. Brug aldrig `prefetch={true}` på links ind i en anden klub. | Automatisk prefetch renderer layouts, og en skrivning dér skiftede aktiv klub ved et hover. Next 16.4 skjuler prefetch-headere, så en header-guard er umulig. | Udvider D-036 |
| ~~D-053~~ | 2026-10-08 | ~~Catch-all `c/[clubId]/[...rest]` giver 404 inde i klubbens AppShell. For medlemmer er det en "blød" 404 (HTTP 200 + `noindex`), fordi `notFound()` kører under `loading.tsx`. ~~ Erstattet af D-065 | AppShell bevares. Den bløde 404 skal afgøres før runde 2's `/events/[eventId]` (TG-008). | – |
| D-054 | 2026-10-08 | Dataadgang via `src/server/<feature>/{queries,mutations}.ts` (fx `server/clubs`, `server/users`), altid scopet på `clubId`. `src/app/**` og `src/server/actions/**` må ikke importere `@/server/db` (håndhævet med ESLint). Undtagelser: `server/auth/**` og `server/rate-limit.ts`. | Håndhæver lagdelingen i §4.2. | – |
| D-055 | 2026-10-08 | Profil viser altid rækken "Opret eller join ny klub" | Med én klub er ClubSwitcher kun et link, så der var ingen vej til onboarding. | – |
| D-056 | 2026-10-08 | Fejl i formularfelter flytter fokus til feltet. `FieldError` er ikke en live region. `FormError` har `role="alert"`. Begge ligger i `src/components/ui/form-message.tsx`. Gælder alle fremtidige formularer. | §15.2. Undgår dobbelt oplæsning. | – |
| ~~D-057~~ | 2026-10-08 | ~~Overblik med ét medlem: "Del" er skærmens ene primære handling, og "Opret event" vises som outline~~ Forældet: Overblik har ikke længere invitationskortet (D-163). Princippet (én primær handling) gælder stadig, fx afstemningskortet over hero'en (D-137). | §13.4.5: én primær handling pr. skærm. Supplerer D-044. | – |
| D-058 | 2026-10-08 | På Vercel bruger migrations Neons `DATABASE_URL_UNPOOLED` (pr. miljø og preview-branch). `DIRECT_URL` er kun til lokal/manuel brug og afvises på Vercel-previews. Guard i `src/lib/migration-url.ts`. Previews kræver Neon preview-branching. | En Vercel-variabel er den samme for alle previews, så et preview-build kunne ellers migrere produktion. | §4.8 (DIRECT_URL) |
| D-059 | 2026-10-08 | Integrationstests mod en dedikeret `olklubben_itest` (`npm run test:integration`, kun `next/headers` og `next/cache` mockes). `npm run check` = typecheck + lint + format + unit. | §15.3. `npm test` forbliver uden database. | – |
| D-060 | 2026-10-08 | Lange klubnavne ombrydes med orddeling (`lang="da"`): op til 3 linjer i klubvælgeren og 2 i klubskifteren. Ingen afkortning med "…". | Navne skal kunne læses. 375 px giver kun ~159 px tekstbredde. | – |
| ~~D-061~~ | 2026-10-08 | ~~Runde 2: events kan redigeres og slettes af opretteren eller en admin. Værter (`EventHost`) kommer i runde 3 sammen med steder.~~ Erstattet af D-098 | §16.3 knytter værter til stedets ejere, og steder kommer først i runde 3. | – |
| ~~D-062~~ | 2026-10-08 | ~~Runde 2-kalender: listevisningen viser kommende events, og månedsvisningen kan bladres til alle måneder (også tidligere). En egentlig historiksektion ("Vis tidligere") kommer i runde 3.~~ Erstattet af D-107 | §16.3 placerer "eventhistorik" i runde 3. | – |
| D-063 | 2026-10-08 | Runde 2 inkluderer redigering og sletning af øl (opretter eller admin, §5.1, E14), filter på event og dublet-advarsel (§9.5), selvom runde-planen kun nævner tilføj/se/søg/sortér | Kataloget skal kunne rettes (stavefejl), og §9.5 er detaljespecifikationen for kataloget. | – |
| D-064 | 2026-10-08 | Forslaget til eventtitel er "Ølsmagning #N", hvor N = antal events i klubben + 1 | Fortolkning af §9.2 ("antal tidligere events + 1"). | – |
| D-065 | 2026-10-08 | Rutestruktur for ægte 404 (TG-008): ingen `loading.tsx` direkte under `c/[clubId]`. Overblik ligger i `(overview)/` og kataloget i `beers/(catalog)/`. Ressourcer har guard-layouts (`events/[eventId]/layout.tsx`, `beers/[beerId]/layout.tsx` → `requireEvent`/`requireBeer`) **over** en `(detail)/loading.tsx`. Redigeringssider og `[...rest]` har ingen `loading.tsx`. | Medlemmer får ægte HTTP 404 (ukendt, ugyldigt eller anden klubs id), og detaljesider beholder skeletons. **Mønster for nye ressourcesider (fx sange og steder i runde 3).** | D-053 |
| D-066 | 2026-10-08 | Event- og ølsider bruger `requireEventPage`/`requireBeerPage` (= `requireEvent`/`requireBeer` + husk aktiv klub). Guard-layouts skriver ikke. En redigeringsside for en ressource, man ikke må redigere, giver 404. | 404 kommer, før den aktive klub ændres. D-052 gælder stadig. | – |
| D-067 | 2026-10-08 | `E2E_SERVER=1` (sat i Playwrights `webServer.env`) slår Next' dev-indikator fra. :3000 beholder den øverst til højre. | Løser TG-009. | – |
| D-068 | 2026-10-08 | Overnatning: en sluttid før starttiden betyder næste dag (18:30–01:00). Samme tid afvises. Et event hører til den kalenderdag, det starter. | §9.2 og CHECK `ends_at > starts_at`. | – |
| D-069 | 2026-10-08 | Vægur → UTC følger Temporals "compatible"-regel: en tid i forårets hul rykkes frem, og en tvetydig oktobertid tager sommertiden. Implementeret alene med `tzOffset` fra @date-fns/tz (F-034). date-fns bruges til ISO-uger. Visning sker stadig efter D-039. | Deterministisk uanset maskinens tidszone (Vercel kører UTC). §4.6: ingen håndskrevet tidszonematematik. | – |
| D-070 | 2026-10-08 | Alkoholprocent: komma eller punktum, mellemrum og afsluttende `%` accepteres. Mere end én decimal afvises ("Brug højst én decimal, fx 5,2."). Intervallet er 0–99,9. Visning: "5,2 %" med hårdt mellemrum. | Ingen stille afrunding. §9.5. | – |
| D-071 | 2026-10-08 | Titelforslag: "Ølsmagning #" + (max(antal events, højeste eksisterende "Ølsmagning #N") + 1) | En klub, der starter midt i en serie, får det rigtige næste nummer. Præciserer D-064. | – |
| D-072 | 2026-10-08 | `Event.createdById`, `Beer.createdById` og `BeerRating.userId` → User med ON DELETE RESTRICT | Historik og ratings fra tidligere medlemmer bevares (§7.4, Q6). Fremtidig kontosletning skal anonymisere (`User.deletedAt`) i stedet for at slette. | – |
| D-073 | 2026-10-08 | "Øllens event er i samme klub" håndhæves kun i datalaget (i en transaction). Ekstra index `beer_ratings(user_id)`. Gennemsnit via GROUP BY sum/count. `formatRating` runder half-up ("4,35" → "4,4"). | En sammensat FK kan ikke kombineres med ON DELETE SET NULL uden også at nulstille `club_id`. | – |
| D-074 | 2026-10-08 | Kataloget har URL-kontrakten `?q=`, `?sort=` (rating, most-rated, newest, abv-desc, abv-asc, name) og `?event=` (id, `none` = uden event, standard alle). Øl uden ratings står sidst ved rating-sortering. Navne sorteres med dansk collator (Æ Ø Å efter Z, "aa" som "å"). Filteret tilbyder events med øl plus det aktive. "Tilføj som ny øl" → `/beers/new?name=`. | §9.5. Delbare og refresh-sikre filtre. | – |
| D-075 | 2026-10-08 | Toasts efter redirect: Server Actions tilføjer `?toast=<nøgle>` (`withToast`, `src/lib/flash-toast.ts`). Én `<FlashToast/>` i klublayoutet viser den faste besked én gang og fjerner parameteren. Kun kendte nøgler vises (ingen brugertekst i URL'en). | En redirect fra en Server Action afviser klientens promise. Mønsteret virker også uden JS. **Gælder alle fremtidige mutationer.** | – |
| D-076 | 2026-10-08 | Alle klublinks bygges med `src/lib/routes.ts` (`eventHref`, `beerHref`, `newBeerHref`, `mapsSearchUrl` …). Kalender-URL'er bygges i `calendar-params.ts`. | Ét sted for URL'er. | – |
| D-077 | 2026-10-08 | Overblik: h1 er et skjult (sr-only) "Overblik", og hero-titlen er h2. Tom tilstand: "Ingen kommende ølsmagninger endnu 🍺" (§9.1). Op til 4 kommende events under hero'en, derefter "Se hele kalenderen". | §3.2: det første, man ser, er næste event. Klubnavnet står allerede i top-baren. | D-044 |
| D-078 | 2026-10-08 | Kalender: URL-kontrakten `?view=list|month`, `?month=YYYY-MM`, `?day=YYYY-MM-DD` (ugyldige værdier → standard). Uden `?view` renderes begge, og et CSS-breakpoint vælger (liste på mobil, måned på desktop). Mobilens månedspanel viser hele måneden, til en dag vælges. Månedsgitteret er en semantisk `<table>`, ikke `role=grid`. Tidligere events vises dæmpet. | Ingen JS-afhængighed, intet blink af forkert visning, og links virker før hydrering. `role=grid` lover piletaster, som kræver JS. | – |
| ~~D-079~~ | 2026-10-08 | ~~D-057 udvidet: i en klub med ét medlem og et kommende event er hero'ens knapper outline, så "Del" forbliver den eneste primære handling~~ Forældet af D-163. | §13.4.5. | – |
| D-080 | 2026-10-08 | Eventsiden: før start er "Rediger" primær for opretter/admin. Ellers (og fra start) er "Tilføj øl" primær. Statusbadge fra `heroState`. ~~"Åbn i kort" er altid en Google Maps-søgning på friteksten.~~ (Erstattet af D-101.) "Oprettet af" står i kortets fod. Sletning sker kun fra detaljesiden. `/events/new?date=` udfylder datoen på forhånd. Eventsider markerer "Kalender" i navigationen. | §13.4.5 og §10.5-flowet under smagning. | – |
| D-081 | 2026-10-08 | "Øl smagt til dette event" genbruger katalogets `BeerCard` (med "Din: –"), i den rækkefølge øllene blev tilføjet | Under smagningen kan man se, hvad man mangler at rate. | – |
| D-082 | 2026-10-08 | BeerRating: begge halvdele af første stjerne giver 1. Taps gemmer med det samme, og tastatur gemmer 600 ms efter sidste tast (eller ved blur). Venstre/ned sænker og højre/op hæver (som en slider). **Halv-stjerne-trykfladerne (~29×52 px) er undtaget fra 44 px-reglen (§13.4.4).** | §9.5 kræver ti halve trykflader, og de kan ikke være 44 px brede på 375 px. WCAG 2.5.8 (24 px) er opfyldt, og piletaster er et alternativ. Én request pr. tastetryk ville give støj. | – |
| D-083 | 2026-10-08 | Dublet-advarsel: med JS er en synlig live-advarsel bekræftelsen ("Tilføj alligevel" sender `confirmDuplicate`). Serveren tjekker altid (fx hvis en anden har tilføjet samme øl imens). Gælder også ved omdøbning ("Gem alligevel"). | §9.5, E21. | – |
| D-084 | 2026-10-08 | `formatWeekdayShort` giver altid tre bogstaver ("tor"). Ingen `tabular-nums` på tal i Zilla Slab ("11" blev "1 1"). Ølformularer ligger i et Card som eventformularerne. Ølsidens titel er ølnavnet. | Konsistens. | – |
| D-085 | 2026-10-08 | D-042 ("virker uden JavaScript") gælder for auth-siderne. Klubsider under en `loading.tsx` kræver JS for at vise streamet indhold, men formularerne virker før hydrering. | Next afslører streamet indhold med inline-scripts. Det realistiske tilfælde (langsom JS-bundle) virker. | Præciserer D-042 |
| D-086 | 2026-10-09 | Dublet-nøglen for øl (E21) = renset navn (NUL fjernet, NFC) i dansk lowercase uden **al** whitespace (`beerDuplicateKey`/`findSameNameBeers` i `src/server/domain/beers/name.ts`). Én implementering for klient og server. Søgning bruger stadig `normalizeBeerName` (beholder ordgrænser). | §9.5: "uden hensyn til store/små bogstaver og mellemrum", som for invitationskoder (§7.3). Klient og server brugte før forskellige regler. | Præciserer D-083 |
| D-087 | 2026-10-09 | Kalender: `loading.tsx` følger `?view`, og uden `?view` vises det responsive par. "Liste \| Måned" er stadig `?view=`-links, men en klient-`ViewToggleLink` flytter fokus til det nye links efter skift. Ved grænserne (1900-01, 2999-12) er ‹/› deaktiverede knapper. | Intet layout-hop. Fokus faldt til `<body>`. | Udvider D-078 |
| D-088 | 2026-10-09 | Overblik: mens hero-eventet er "I gang nu", er top-barens "+" "Tilføj øl" (med eventet udfyldt). Ellers er den "Opret event". | Samme primære handling som hero'en (§13.4.5). | Udvider D-080 |
| D-089 | 2026-10-09 | Redigeringssider kalder `requireEvent`/`requireBeer` → `canEdit*` → husk aktiv klub, så en rettigheds-404 heller ikke skifter aktiv klub | Konsekvens af D-066's begrundelse. | Præciserer D-066 |
| D-090 | 2026-10-09 | Fælles hjælpere til nye runder: `src/lib/search-params.ts` (`firstParam`), `src/server/revalidate.ts` (`revalidateClub`, server-only, bevidst ikke i en "use server"-fil), ressource-ref-schemas i `src/lib/validation/*` (fx `beerRefSchema`), `averageFromSum` som eneste gennemsnitsformel. **Alle fritekst-schemas bruger `stripNul` (`src/lib/text.ts`), og alle felter, der parses før auth, har et længdeloft før parsing.** Runde 3: `optionalText` sætter loftet på det rå input før rensning (`rawTextLimit`), og `cleanOptionalText` er den eneste rensning af valgfri tekster. | Fjerner kopier mellem runde 2-agenterne. Postgres `text` afviser U+0000 (F-046), og ReDoS (F-044). | – |
| ~~D-091~~ | 2026-10-09 | ~~Sangbogen (opgave 3.1) springes over i runde 3 og bygges, når den eksisterende sangbog ligger i `data/sangbog/` (Q5). "Sangbog" forbliver en "kommer snart"-side i navigationen.~~ | Jespers ønske: sangbogsfilen er ikke klar, og import-formatet afhænger af den. Erstattet af D-118. | – |
| D-092 | 2026-10-09 | Ny palet (Jespers ønske): primærfarven er oliven `#414437` (den eneste af de tre tilbudte farver, der reelt er grøn) og bruges både til app-rammen og som handlingsfarve. Afledt: `olive-soft #525742`, `olive-deep #2D2F23`, `olive-tint #E3E8CE`, `on-dark-muted #CECFC4`. Sekundærfarven er havneblå `harbor #3E5568` (+ `harbor-soft #4E6679`, `harbor-tint #DCE6EE`) til hero-kort, "Klubbens rating", "i dag" og info. Navy, bottle, mist og steel er fjernet. `on-navy` er erstattet af `on-olive`/`on-harbor`. Tekst på messingknappen er `ink`. Dialog-baggrunden er neutral `ink/50`. Se §13.2. | Jesper ville have grøn som primær og en blå, der passer til. `#3E5568` blev valgt efter screenshots frem for `#4A6274` (fejler AA: dæmpet tekst 3,65, stjerner 2,61) og `#2F4858` (samme lyshed som olive, så hero'en ikke skiller sig ud fra top-baren). | §13.2 v1 (navy/bottle) |
| D-093 | 2026-10-09 | Desktop-sidebaren viser ikke "Profil" i listen. Brugerrækken nederst (avatar, navn, email) ligger i hovednavigationen, har det tilgængelige navn "Profil: <navn> <email>" og er markeret aktiv (`aria-current`, olive-soft + messingring) på `/c/{id}/profile` og `/c/{id}/club`. Mobilens bundnavigation beholder alle fem punkter. Én kilde: `sidebar: "list" \| "user-row"` på punkterne i `nav-items.ts` + `getSidebarNav`. | Jespers ønske: Profil stod to gange i sidebaren. Mobil har ingen brugerrække. | Afviger fra §8.1 v1 ("de samme punkter") |
| D-094 | 2026-10-09 | Runde 3 leveres i faser: først TG-021 (F0) bag en formular- og auth-E2E-gate, så ét fundament (skema, migrering, domæne, validering, datalag, interim-eventformular, alle nye rutefiler med endelige guards, seed), så tre parallelle agenter med eksklusivt filejerskab (A profil og medlemmer, B steder, C events med steder og historik), en integrator og til sidst et adversarial review. Hver agent har sin egen `_itest`-database og kører kun sine egne E2E-specs, serialiseret med `flock`. SPEC.md har én skribent. | Datamodellen ligger under alle tre features. En fast kontrakt fra fundamentet gør det sikkert at bygge UI'et parallelt. | – |
| D-095 | 2026-10-09 | Steder: navn 1–120 tegn, adresse ≤ 200, beskrivelse ≤ 1000 (CHECKs). `name_key` = `placeNameKey(name)` (D-086-reglen) og er unik blandt klubbens aktive steder via et partielt unikt index (`partialIndexes` som D-027, aldrig `findUnique` på det). Skrivninger af navne serialiseres pr. klub med `pg_advisory_xact_lock` og et forhåndstjek. En dublet giver en feltfejl med link til stedet (`PLACE_NAME_TAKEN`). `createPlace` låser opretterens medlemskab (FOR SHARE), før ejerrækken skrives. | Runde 2's fritekst kunne være 120 tegn, så migreringen er tabsfri. Et forhåndstjek under lås undgår at fange P2002/P2003 i en interaktiv transaction, som Postgres afbryder. | §11 Place.name (1–80) |
| D-096 | 2026-10-09 | Club isolation i databasen: sammensatte FK'er `events(place_id, club_id) → places(id, club_id)` RESTRICT, `place_owners(place_id, club_id) → places` CASCADE og `place_owners(user_id, club_id) → memberships(user_id, club_id)` CASCADE. `event_hosts.user_id → users` RESTRICT; medlemskab tjekkes ved skrivning under FOR SHARE. Kun "unchecked" skalar-input ved skrivning, aldrig `connect`. | §4.4 håndhæves nu af databasen for steder, ejere og events: en ejer er altid medlem, og ejerskabet ophører med medlemskabet (§7.4). Værtskaber er historik og må overleve medlemskabet. Øl har stadig ingen sådan garanti (TG-022). | – |
| D-097 | 2026-10-09 | D-022-migreringen: ét sted pr. (klub, navnenøgle), med en SQL-whitespace-klasse, der svarer til JS `\s`. Navn = mest brugte stavemåde, så den senest brugte, så alfabetisk. Opretter og tidspunkt fra klubbens tidligste event med den nøgle. Adresse = teksten, når den indeholder et ciffer. Ingen ejere. Eksisterende events får opretteren som vært. Tom tekst → "Ukendt sted". Id'er er UUIDv4 fra `gen_random_uuid()`. `events.place_id` bliver NOT NULL i samme migrering; `location_text` bliver nullable og ubrugt og droppes i runde 4 (TG-032). Testet automatisk på en midlertidig C.UTF-8-database (`round3-migration.itest.ts`). | Der er ingen produktion endnu (TG-012), så det korte vindue under en deploy, hvor gammel kode ikke kan oprette events, accepteres (§4.8). Ejerskab er selvvalgt (§9.4): "Hos Mads" gættes ikke til at være Mads'. Verificeret på dev: 4 events → 4 steder og 4 værtskaber, ingen events uden sted, vært eller på tværs af klubber. | – |
| D-098 | 2026-10-09 | Værter (§9.2): medlemskort i eventformularen. Et ikke-tomt valg er værterne (nye værter skal være nuværende medlemmer; eksisterende værter, der har forladt klubben, må blive). Tomt = standarden: stedets ejere, der er medlemmer (højst 20), ellers opretteren; ved redigering eventets opretter, hvis medlem, ellers den, der redigerer. Højst 20 værter. Redigere og slette et event = opretter, vært eller admin. Når et medlemskab ophører, fjernes kun værtskaber på events, der ikke er startet. `updateEvent` låser event → sted → medlemskaber og læser de eksisterende værter efter medlemskabslåsen (F-055). | §9.2 og §16.3. Uden JS sendes præcis det viste. Værtskaber på afholdte events er historik (§7.4). | D-061 |
| D-099 | 2026-10-09 | "＋ Nyt sted" er et radio-kort i stedvælgeren med felter, der foldes ud med CSS (virker før hydrering). Stedet oprettes i eventets transaction, og et aktivt sted med samme nøgle genbruges med sin egen adresse. Felterne for nyt sted valideres kun, når "nyt" er valgt ("Giv stedet et navn.", som på Nyt sted-siden). Stedvælgeren: native radio-kort, senest brugte først (seneste `startsAt`, også planlagte events). Intet forvalg, medmindre klubben har 0 steder ("nyt" åbnes), præcis 1 eller `?placeId=` (et aktivt sted i klubben). Et arkiveret nuværende sted kan blive valgt ved redigering (E30). | §9.2 "uden at forlade formularen". Ingen dialog betyder ingen portal-fælder og ingen ekstra action. Et forkert forvalgt hus er værre end ét tryk. | – |
| D-100 | 2026-10-09 | Fjernelse af steder er én handling: ubrugt → slettes, brugt → arkiveres, afgjort under en FOR UPDATE-rækkelås, og knappen hedder det, der vil ske. Arkivere = ejer eller admin; slette et ubrugt sted = ejer, admin eller opretter; gendanne = ejer eller admin (en navnekonflikt afvises med link). Alle medlemmer må redigere, også arkiverede steder. Ejer-toggle sender den ønskede tilstand; admins fjerner andre ejere. Runde 4 udvider `PlaceUsage` (en åben afstemning blokerer, E5). | §5.1 og §9.4. Opretteren må rydde op efter en tastefejl. Da ejerskab er selvvalgt, er "kun ejer" en bremse mod fejltryk, ikke en adgangskontrol (§3.3). | – |
| D-101 | 2026-10-09 | "Åbn i kort" er en Google Maps-søgning på `Place.address` og vises kun, når stedet har en adresse. Ellers et lille "Tilføj adresse"-link til stedets redigering. | En kortsøgning på "Hos Mads" er meningsløs. | D-080 ("Åbn i kort" på friteksten) |
| D-102 | 2026-10-09 | Medlemsadministration: hver ændring serialiseres af `SELECT id FROM clubs … FOR NO KEY UPDATE`, og aktørens rolle og hele medlemslisten læses igen under låsen. `endMembership` sletter medlemskabet først (ejerskaber følger med via FK), så værtskaber på kommende events, så `lastActiveClubId`. At fjerne et ikke-medlem er en no-op; en rolle til et ikke-medlem giver 404; at fjerne sig selv = "Forlad klubben"; at nedgradere sig selv er tilladt med mindst to admins. Den sidste admin, der vil gå, får beskeden og genvejen "Gør et medlem til admin". Admins har en '⋯'-menu pr. medlem med nulstillingslinket indeni (opfylder D-041). Dialogerne ligger uden for menuen (styret `ConfirmDialog`), og fokus vender tilbage til '⋯'. | E25 uden at låse rækker, som FK-inserts også skal bruge (NO KEY UPDATE blokerer ikke KEY SHARE). Med den rækkefølge kan samtidige skrivninger ikke efterlade værtsrækker for et tidligere medlem. | §11 "lås admin-medlemskaberne" |
| D-103 | 2026-10-09 | Slet klub: det skrevne navn sammenlignes efter NFC, samlede mellemrum, trim og dansk lowercase. Knappen aktiveres live, og serveren tjekker igen under låsen. Dialogen viser indholdet ("14 events, 37 øl med 102 ratings og 5 steder"). Events slettes før klubben som forsvar i dybden (RESTRICT er verificeret at virke). Runde 4 skal slette afstemninger før steder. Bagefter → forsiden med en toast. | §7.5. Store/små bogstaver og mellemrum er ikke en meningsfuld del af en bekræftelse. | – |
| D-104 | 2026-10-09 | `<FlashToast/>` flytter fra klublayoutet til `src/app/layout.tsx`, så "club-left" og "club-deleted" vises på /onboarding, /clubs og i andre klubber. Redirect-målet efter forlad og slet beregnes fra en ucachet klubliste (`homePathAfterLeaving`, `lastActiveClubId` ignoreres). | `getUserClubs` er cachet pr. request og ville stadig indeholde den forladte klub. | Udvider D-075 |
| D-105 | 2026-10-09 | Kælenavn: `User.nickname` 1–40 (CHECK) er et Better Auth-`additionalField` med `input: false`, så `POST /update-user` og signup afviser det (FIELD_NOT_ALLOWED). Det skrives kun af `updateUserProfile` sammen med navnet. `getDisplayName` overalt; medlemslisten og profilen viser "Kaptajnen (Jesper Thomsen)"; lister sorteres efter visningsnavn; emails bruger det officielle navn. | D-011. Én skrivevej, så ingen kan omgå rensning og længdegrænse. | – |
| D-106 | 2026-10-09 | Indstillinger (§9.8): skift password via `auth.api.changePassword` med `revokeOtherSessions: false`, hvorefter appen sletter brugerens andre sessions og alle udestående nulstillingslinks (udvider D-047). Rate limits: `/change-password` 10/15 min pr. IP og 10/15 min pr. bruger (talt efter validering og medlemskabstjek). Kortet vises kun for konti med password-login; rene Google-konti får en forklaring. Formularen har et skjult brugernavnsfelt (emailen) til password-managere. ~~[SENERE]: email-ændring (TG-033, Q13) og "Google-konto tilføjer password" (TG-034).~~ Erstattet 2026-10-18 af D-151 (skift email) og D-152 (tilføj password). Profilbilledet er stadig kun fra Google (D-048). | Sessionen læses via `headers()`, så et cookie-skift inde i actionen ville logge brugeren ud. Better Auth skifter email med det samme uden password og ignorerer stille en email i brug, og `setPassword` har intet friskhedstjek. | §9.8 v1 (email og "tilføj password") |
| D-107 | 2026-10-09 | Eventhistorik: Overblik viser "Tidligere ølsmagninger" (de 3 nyeste med antal øl og den bedst ratede øl) efter de kommende events og under den tomme tilstand. Kalenderlistens sektion `#tidligere` viser de 12 nyeste pr. måned (nyeste først), resten med `?past=all`. Stedets side viser "Ølsmagninger her". "Afholdt" er det præcise modstykke til "kommende eller igangværende" (§9.1). | §16.3. Udvider D-078. | D-062 |
| D-108 | 2026-10-09 | Runde 3-ruter efter D-065: `places/(list)` og `places/new` har loading; `places/[placeId]/layout.tsx` er guard (`requirePlace`) over `(detail)/loading.tsx`; redigering har ingen loading og kalder `requirePlace` → `canEditPlace` → husk aktiv klub. Klubsiden flytter ind i `club/(members)/` (URL uændret), så dens loading ikke omslutter `club/edit`, der kun er for admins og ellers giver ægte 404. Stedernes sider markerer Profil aktiv (udvider D-093). `newEventHref` tager `{ date, placeId }`. | Ægte 404 for ukendte, ugyldige og andre klubbers steder (E22), også under `next start`. | – |
| D-109 | 2026-10-09 | TG-021 er løst: `useActionForm`, `form-validation` og `form-fields` (`FieldShell`, `InputField`, `TextareaField`, `CheckboxField`, `ChoiceFieldset`) ligger i `src/components/features/forms/`, og `readFormValues` (listefelter, loft = max + 1, `exclude`) i `src/lib/form-data.ts`. Server-fieldErrors flytter nu også fokus i auth-formularerne (D-056). En serverfejl med fieldErrors vises kun ved felterne, uanset kode (fx et forkert nuværende password). Fokus i en gruppe: den valgte radio, ellers den første synlige kontrol. `ConfirmDialog` kan styres udefra (`open`/`onOpenChange`, valgfri `trigger`) og har `confirmDisabled`. Porteret: event → øl → opret klub → auth. JoinCodeForm (navigation, ingen action) er ikke porteret. | Én formularmotor i stedet for tre kopier, før runde 3's nye formularer (profil, password, klubinfo, sted, event v3). | – |
| D-110 | 2026-10-09 | Klubbens beskrivelse er 1–300 tegn (CHECK). Navn og beskrivelse redigeres på `/c/[clubId]/club/edit` (kun admins, ellers 404). | Klubsiden forbliver en oversigt; redigering er en egen formular som de andre. | – |
| D-111 | 2026-10-09 | Stedvælgerens kort: hvert sted er en usynlig native radio, der dækker hele kortet (opacity-0, øverst), og kortet tegnes med `peer-*` (prik, valgt, fokusring). Det tilgængelige navn er præcis stedets navn (+ " (arkiveret)"); meta-linjen er `aria-hidden` og koblet via `aria-describedby`. "＋ Nyt sted"-felterne vises med `group-has-[.place-radio:checked]/choice:grid`. Radioer har ingen `aria-invalid` (rollen understøtter det ikke); gruppefejlen læses via `aria-describedby`. | Virker før hydrering, tryk rammer selve radioen, skærmlæsere hører kun navnet, og Playwrights `check()` virker (F-065). | Designets "peer sr-only" |
| D-112 | 2026-10-09 | Værtsvælgeren: uberørt følger den forslaget for det valgte sted. Ved redigering starter den uberørt, kun hvis de nuværende værter er lig forslaget. Den viste fallback er eventets opretter, mens vedkommende er medlem, ellers den, der redigerer. "Brug stedets ejere" vises kun, når stedet har ejere, og valget afviger. | Supplerer D-098 med UI-reglerne, så klient og server foreslår det samme. | – |
| D-113 | 2026-10-09 | Kontrollerede radioer, checkbokse og selects i Server Action-formularer skal overleve React 19's automatiske `form.reset()` efter et svar: en layout-effekt pr. action-state (aldrig ved mount) sætter DOM'en tilbage (`useCheckedAfterReset` for steder og værter, det samme for ølformularens event-select). Valg, der er foretaget før hydrering, overtages ved at sammenligne `checked` med `defaultChecked`. | Retter F-053-klassen og indsnævrer TG-037. | – |
| D-114 | 2026-10-09 | Historikkens præsentation: `pastEventMetaDisplay` holder "★ 4,7" samlet med hårde mellemrum. Historikkens månedsregioner hedder "Tidligere ølsmagninger <Måned ÅÅÅÅ>" (`aria-labelledby` på sektions- og månedsoverskriften). Links bygges med `calendarHistoryHref`. `ScrollToHash` scroller til `#tidligere`, fordi Next ikke scroller til mål, der streames ind bag `loading.tsx` (F-066). | Ratingen må ikke stå alene på en linje, og navnene må ikke kollidere med de kommende måneder (F-069). | – |
| D-115 | 2026-10-09 | Ejer-toggle: én almindelig knap, hvis etiket siger, hvad den gør ([ Det er mit sted ] / [ Fjern mig som ejer ]), plus en høflig statuslinje ("Du er nu ejer af stedet."). Ingen `aria-pressed`. Optimistisk, ruller tilbage med en fejl-toast, ingen confirmation. | §9.4 kræver to etiketter, og WAI-ARIA APG siger, at en `aria-pressed`-knap skal beholde sit navn. | Designets "aria-pressed" |
| D-116 | 2026-10-09 | Admin'ens egen række på medlemslisten har også '⋯'. Den indeholder kun "Fjern min admin-rolle", deaktiveret med begrundelsen, når man er den sidste admin. Nulstillingslink tilbydes aldrig til en selv. | Vejen til at nedgradere sig selv skal være den samme som for andre, og den sidste admin skal kunne se hvorfor ikke. | – |
| D-117 | 2026-10-09 | Sømme fra integrationen: et steds side linker tilbage til "Alle steder", og dens "Ølsmagninger her" viser ugedag og tid i stedet for stedets eget navn (`EventListItem showPlace={false}`). Olivenfarvede toasts har en messingkant (løser TG-039). Tilladelsesbeskeder følger mønstret "Kun X og klubbens admins kan …" (fx "Kun stedets ejere, opretteren og klubbens admins kan slette det."). | Steder har intet hovedpunkt (§8.1). Toasts gik i ét med oliven-båndet på CenteredShell-sider. Ens sprog for ens regler. | – |
| D-118 | 2026-10-13 | Sangbogen (opgave 3.1) bygges i runde 3 alligevel: Jesper har leveret de 59 PDF'er i `data/sangbog/`. Hans krav: sangene vises **i appen** (ikke som download), kan søges og står alfabetisk. "Kommer snart"-siden er væk. | Q5 er besvaret, og sangbogen er en del af runde 3's "klubbens samlede arkiv". | D-091 |
| D-119 | 2026-10-13 | Testomfang for sangbogen (Jesper: "Du behøver ikke at teste sangbogen. Kun at den bliver renderet. Jeg tester til sidst."): ingen E2E-, integrations- eller unit-suiter for sangbogen og ingen løkker over de rigtige data. Gaten er typecheck, lint, format, build og et render-tjek (HTTP 200, ingen konsolfejl, ingen vandret scroll), og alle eksisterende suiter skal være grønne. Jesper tester sangbogen manuelt. | Jespers valg. Undtagelse fra §15.1/§15.3 for netop denne feature; se TG-043. | Designets testplan (G1–G4) |
| D-120 | 2026-10-13 | Tekst først: appen gemmer og serverer aldrig PDF'erne; originalerne bliver lokalt i `data/sangbog/` (git-ignoreret, `.vercelignore`, `*.pdf`/`*.zip` i `.gitignore`). Rigtige tekster og titler kommer aldrig i repoet (§19.1 punkt 10); seed og tests bruger opdigtede sange. Importrapporten `data/sangbog/import-report.json` indeholder tekster og ligger derfor kun under `data/`. | Sangene er klubbens private kopi af ophavsretligt beskyttede tekster. Tekst kan søges, skaleres og vises på telefonen; en PDF kan ikke. | – |
| D-121 | 2026-10-13 | `Song`-modellen (§11): Nummer fjernet, Kunstner tilføjet, `lyrics` → `body` i sangtekstformatet, unik `titleKey` (`nameKey`) pr. klub, akkorder trukket frem fra [SENERE]. Importens herkomst i `sourceKey`/`importHash` med 8 CHECKs (inkl. "begge eller ingen"); appens skrivninger rører dem aldrig. En titeldublet (P2002) bliver `SONG_TITLE_TAKEN` med et link til sangen, der har titlen (som steder). | Sangbogen har ingen numre (Q5). Importen skal kunne køres igen uden at overskrive sange, der er rettet i appen. | §11 Song v1 |
| D-122 | 2026-10-13 | Sangtekstformatet (§9.6) klassificeres ved visning af `src/server/domain/songs/song-text.ts` (`lineKind`: `\`-escape → tom → etiket → note → akkorder → tekst). Strammere noteregel end prototypen (`capo:`/`capo 2`, ikke "Stemning i lejren"), danske etiketter, positionerede akkordlinjer bliver ordbokse (akkord over ordets start, ingen ombrydning inde i et ord). | Ét format, som både importen, formularen, forhåndsvisningen og læsevisningen bruger. Teksten gemmes, som den er skrevet, så reglerne kan forbedres uden migrering. | – |
| D-123 | 2026-10-13 | Søgning på klienten: listesiden sender titel, kunstner, melodi og `lyricsOnlyLines` for alle sange, og `matchSongs` kører i browseren (og på serveren for `?q=`). `searchKey` (dansk lowercase, accenter væk men æ/ø/å bevaret, apostrof og bindestreg fjernet) og `looseKey` (æ → ae, ø → o, å → a) kun som fallback, når den strenge søgning finder 0. Rang 0–5 (titel først, tekst kun fra ordstart). `?q=` skrives med `history.replaceState` (debounced). Sortering og bogstaver kun på serveren: `titleSortKey` + `Intl.Collator('da')` (base, numeric), bogstav = det største bogstav ≤ nøglen ("Aa…" → Å, tal → #). | Øjeblikkelig søgning, også på dårlig wifi i baren. 59 sange er få kB. Se TG-045 for grænsen. | §9.6 "søger i titel og tekst" |
| D-124 | 2026-10-13 | Læsevisningens præferencer (7 skriftstørrelser 16–32 px, Tekst/Akkorder) gemmes i `localStorage` og sættes som `data-song-size`/`data-song-view` på `<html>` af et konstant inline-script i rodlayoutet (`SongbookPrefsScript`, `suppressHydrationWarning` kun på `<html>` og scriptet). Begge visninger renderes på serveren og vises/skjules af ulagdelt CSS i `globals.css`. På klienten er scriptet `type="text/plain"` (F-071). Det er sangbogens eneste `dangerouslySetInnerHTML`; teksterne renderes kun som tekst og `<mark>`. Mobilens skriftknapper sidder i top-baren. | Intet blink af forkert størrelse eller visning før hydrering, og ingen hydreringsfejl. | – |
| D-125 | 2026-10-13 | Forrige/Næste følger hele bogen i alfabetisk rækkefølge (ikke søgningen), uden at starte forfra, med `prefetch={true}` inden for klubben (forenelig med D-052) og ← → på desktop. Sletning sker kun fra sangens side (som D-080). "‹ Sangbog" gendanner søgningen fra `sessionStorage`. | Bladring i en sangbog er bogens rækkefølge. Prefetch gør bladringen øjeblikkelig midt i en sang. | – |
| D-126 | 2026-10-13 | Importen (`scripts/import-songbook.ts` + `scripts/songbook/`): `pdftohtml -xml -i -q -nodrm -stdout` med strenge skriftroller (ukendt skrift eller størrelse = FEJL), altid round trip og schema-tjek, statusser efter `sourceKey`/`importHash`, `overrides.json`, alt i én transaction (planen beregnes igen inde i den, `updateMany` med `updatedAt`-vagt). Strammere end designet: en ikke-lokal database kræver `--remote` for **al** adgang, `--user` skal være ADMIN også i en tør kørsel, og `--apply` mod en ikke-lokal database kræver klubbens navn tastet i en TTY. Kører aldrig på Vercel. | Importen må kunne køres igen uden dubletter eller tab af rettelser, og en AI-agent kan ikke skrive til produktion. | §9.6 import v1 ("match på nummer eller titel") |
| D-127 | 2026-10-13 | Sangbogens ruter efter D-065: listen i `songs/(list)/` med loading, `songs/[songId]/layout.tsx` er guard (`requireSong`) over `(detail)/loading.tsx`, `new/` og `[songId]/edit/` har ingen loading og kalder `requireMembership`/`requireSong` → `canManageSongs` → `notFound` → husk aktiv klub. Actions følger steders rækkefølge: id'er (`songRefSchema`, 404) → `songFieldsSchema` → `requireSong` → `canManageSongs` → skriv. | Ægte 404 for medlemmer og andre klubbers sange (E22). Løser TG-025. | – |
| D-128 | 2026-10-13 | Sangbogens præsentation: søgefeltets placeholder er "Titel, kunstner eller en linje…" (designets "Søg …" blev skåret af ved 375 px; label "Søg i sangbogen" er sr-only). Etiketter står med versaler i 0,72 em, gentagne vers (omkvæd) har en 3 px ravfarvet streg i venstre side. A–Å-gitteret hopper med `scrollIntoView` og fokus på overskriften uden `#hash` (før hydrering virker `#bogstav-…`-ankrene). "#" annonceres som "Tal og tegn". Brødtekstfeltet har fast bredde (`wrap=off`, monospace), så akkorder kan rykkes på plads. | Læsbarhed ved 375 px og på creme baggrund; Next håndterer `scroll-behavior: smooth` på `<html>` specielt. | – |
| D-129 | 2026-10-14 | Afstemningernes datamodel (§11): `PollOption.clubId` med sammensatte FK'er `(poll_id, club_id) → polls` (CASCADE) og `(place_id, club_id) → places` (RESTRICT). `PollVote` har PK `(ballot_id, option_id)` og FK'erne `(ballot_id, poll_id) → poll_ballots(id, poll_id)` og `(option_id, poll_id, category) → poll_options(id, poll_id, category)`, så "samme afstemning" og "samme kategori" er databaseregler; et partielt unikt index giver højst ét sted pr. stemmeseddel. `PollTieResolution` er en tabel (PK `(poll_id, category)`, FK til valgmuligheden i samme afstemning og kategori). `Event.pollId` er UNIQUE med en sammensat RESTRICT-FK til `polls(id, club_id)`. `Poll` får `closedById` (kun MANUAL), `cancelledAt` og `cancelledById`. 9 CHECKs (længder, livscyklus, kategori). Stemmesedler → users RESTRICT. Vinderne gemmes aldrig. | Club isolation i databasen som D-096 og D-073 (aldrig SetNull på en sammensat relation). UI'et viser "Afsluttet af Mads" og "Annulleret af Mads …", og en annullering fra uafgjort beholder `closedAt`. | §11 Poll* v2 |
| D-130 | 2026-10-14 | Låse for afstemninger: `lockPoll` = `FOR NO KEY UPDATE` for **alle**, der skriver til en afstemning, også den, der stemmer. Lukningen ved "alle har stemt" sker i stemmens egen transaction. Fast rækkefølge: klub → afstemninger → stednavne (advisory) → steder → event → medlemskaber. `endMembership` låser klubbens åbne afstemninger (`lockOpenPollIds`), før medlemskabet slettes, og sletter så kun brugerens stemmesedler i netop dem (ændrer D-102's rækkefølge). `deleteClub` låser alle klubbens afstemninger `FOR UPDATE` → events → afstemninger → klub (opfylder D-103's note). Den stemmendes medlemskab læses uden lås under afstemningens lås. | Klubber har 5–20 medlemmer, så at serialisere stemmer pr. afstemning koster intet, og det fjerner både SHARE→UPDATE-deadlocket og vinduet, hvor "alle har stemt" er sandt, men afstemningen stadig er åben. NO KEY UPDATE blokerer ikke de KEY SHARE-låse, som FK-inserts tager. Uden afstemningslåsen i `deleteClub` kunne en samtidig lukning indsætte et event mellem de to sletninger. | D-102 (rækkefølgen i `endMembership`) |
| D-131 | 2026-10-14 | Lukning: én funktion, `closeLockedPollTx` (betinget `updateMany … WHERE status = 'OPEN'`, så `createEventFromPollTx` i samme transaction), bag alle udløsere. Lazy close på Overblik, Kalender og afstemningssiden tjekker **både** frist og "alle har stemt", kører aldrig i et layout og kaster aldrig (`closeDuePolls`, `closePollIfDueSafely`). En stemme, der rammer en udløbet afstemning, lukker den og afvises (E6). Manuel lukning af en åben afstemning, hvis frist er gået, gemmes som `DEADLINE` (uden `closedBy`). Cron dagligt `0 4 * * *` UTC med Bearer `CRON_SECRET`, sammenlignet tidskonstant; uden secret 503, forkert token 401. Værter: vinderstedets ejere, der er medlemmer → opretteren, hvis stadig medlem (D-009) → den handlende admin (E11) → ingen (E34). `Event.createdById` er altid opretteren. | Idempotens med betinget opdatering og unik `Event.pollId` (D-007). "Alle har stemt" kan også blive sandt, når nogen forlader klubben, så cron tjekker begge. 503 betyder "slået fra" (en 401 ville skjule en konfigurationsfejl, en 500 ligne et nedbrud). | – |
| D-132 | 2026-10-14 | E5 udvidet: et sted i en **åben eller uafgjort** afstemning kan hverken arkiveres eller slettes. Et sted, der har været valgmulighed i en afstemning, arkiveres, aldrig slettes. `PlaceUsage = { eventCount, pollOptionCount, activePollCount }`, `placeRemovalBlock` → `"in-active-poll"`. Stedets side forklarer det og linker til afstemningen; fjern-knappen vises ikke. | Opfylder D-100's note. `poll_options → places` er RESTRICT, og en uafgjort afstemning kan stadig vælge stedet som vinder. | – |
| ~~D-133~~ | 2026-10-14 | ~~Redigering: valgmulighederne ændres **aldrig** efter oprettelsen (strammere end §9.7.2 v2); er de forkerte, annullerer man og starter en ny. `/c/[clubId]/polls/[pollId]/edit` (opretteren, så længe vedkommende er medlem, eller en admin, kun mens den er åben, ellers ægte 404): titel, tema, beskrivelse og frist. Fristen kan kun rykkes senere og skal stadig ligge før den første dato (E24). En rettelse, der finder en udløbet afstemning, lukker den og svarer `poll-locked`. §5.1 har rækken "Redigere afstemning".~~ Erstattet 2026-10-18 af D-153 (datoer og steder kan rettes, indtil den første stemme er afgivet). | Ingen kapløb mellem valgmuligheder og første stemme, ingen sti, der kan efterlade forældreløse stemmer, og ingen ekstra UI. | §9.7.2 v2 ("kan ikke ændres, når første stemme er afgivet") |
| D-134 | 2026-10-14 | Regler: kun komplette stemmesedler gemmes ("har stemt" = der findes en stemmeseddel). Kryds i en fastlagt kategori ignoreres. Mindst én kategori skal have ≥ 2 valgmuligheder (ellers et link til "Opret event"). Højst 10 datoer og 10 steder. Én fælles starttid (18:30); fristens standardtid er 20:00. Datoer og frist i fremtiden og fristen før første dato: Zod-schemaet er rent (form, længder, frist før første dato), og `checkPollTiming(now)` kører på serveren før og under låsen. | En afstemning uden noget at stemme om er et event. Et schema, der afhænger af "nu", giver overraskelser ved hydrering og skæve ure; serveren er autoritativ. | – |
| D-135 | 2026-10-14 | PollForm: felterne i §9.7.1's rækkefølge med "Tema (valgfrit)" (TG-031). Tre foreslåede datoer på klubbens mest almindelige ugedag blandt de seneste 12 events (ellers lørdag), den første ≥ 7 dage frem; "+ Tilføj dato" lægger en uge til. Fristen følger "2 dage før første dato kl. 20:00" (ellers dagen før kl. 20:00, ellers 3 timer før start), indtil den røres. "＋ Nyt sted" via `findOrCreatePlaceTx` og rulles tilbage, hvis afstemningen afvises. En checkbox-variant af `PlaceChoiceCard` (`type`, `name`); fluebenet er `::before`-indhold med tom alt-tekst, så det ikke kommer med i det tilgængelige navn (F-076). Siderne ejer `PageHeader` (h1) og `Card`; `PollForm` og `PollEditForm` renderer kun formularen. | En formular på 30 sekunder på mobilen (§1.1). Som eventformularen (D-099, D-113). | – |
| D-136 | 2026-10-14 | Stemme-UI: en optimistisk **forhåndsvisning** (§13.4.6) af tal, søjler og "Fører" med egen avatar (stiplet ring, sidst som "dig") og "Ikke gemt endnu", plus en eksplicit [ Gem min stemme ], der sender videre med toasten "vote-saved" (C11, D-075). Stemmesedlen er keyed på `myBallot.updatedAt`. Navne vises ved avatarerne op til 4 stemmer, derover "Se alle (N)". «Ingen passer» er en række på datoernes skala og fører aldrig. Siden opdaterer sig hvert 30. sekund, mens den er synlig og åben, men ikke mens en formular har `data-dirty`. Åbenhedsnoten (D-014). `PollOptionView.isTied` vises kun, mens afstemningen er åben, når topscoren er > 0. | Virker uden JavaScript, som alle andre formularer. En frisk afstemning skal ikke vise "Står lige" overalt. | – |
| D-137 | 2026-10-14 | Synlighed: Overblikkets `PollCard` har fem tilstande (mangler, har stemt, uafgjort for opretter/admin og for andre, afgjort i 3 dage efter lukningen, så længe eventet ikke er slut). Mens et kort venter på brugeren, er hero-kortets [ Se event ] dæmpet (én messingknap, D-057). Kalenderen viser åbne og uafgjorte afstemningers datoer stiplede som "Mulig dato" med "Du kan ✓"; de forsvinder ved lukning og annullering. Eventsiden har "Valgt ved afstemning 🗳". Titelforslag for events og afstemninger tæller åbne og uafgjorte afstemningers titler med. | §9.1 "Aktive afstemninger", §9.3 og §9.7.7 "vises … på Overblik". To planer på samme tid får ikke begge "#15". | – |
| D-138 | 2026-10-14 | Ruter efter D-065: `polls/new` med loading; `polls/[pollId]/layout.tsx` er guard (`requirePoll`) over `(detail)/loading.tsx`; `edit/` har ingen loading. Ingen `/polls`-oversigt (catch-all 404; isolationstesten bruger nu `stats` som ubygget sti, TG-040). `/api/cron/close-polls` og `vercel.json` `crons`. Toast-nøgler: `poll-created`, `poll-updated`, `vote-saved`, `vote-saved-closed`, `vote-saved-tie`, `poll-locked`, `poll-closed`, `poll-awaiting`, `poll-decided`, `poll-cancelled`. Er afstemningen allerede afgjort eller ikke uafgjort, sender afslut/annullér/vælg vinder bare til afstemningen uden toast (et dobbelt tryk gør intet ekstra). | Ægte 404 for ukendte, ugyldige og andre klubbers afstemninger (E22). | – |
| D-139 | 2026-10-14 | TG-032 er gjort: `events.location_text` og dens CHECK droppes i `round4_polls`. Vinduet under en deploy, hvor gammel kode kunne læse kolonnen, accepteres, fordi der ikke er nogen produktion endnu (som D-097). | Død kolonne. | – |
| D-140 | 2026-10-14 | Sangbogens tekstspørgsmål er afgjort af Jesper: de to titler, der er rettet via `overrides.json`, og pladsholderen "X" i den ene sang **beholdes, som de er**. | Jespers valg. Løser TG-048. | – |
| D-141 | 2026-10-16 | Feedbackens datamodel (§11): `Feedback` (UUIDv7, intet `clubId`) og `FeedbackVote` (PK `(feedback_id, user_id)`, begge FK'er CASCADE). `createdById` og `duplicateOfId` er SET NULL. 9 navngivne CHECKs: titel 3–120 efter btrim og ≤ 120 råt, beskrivelse 10–5000, sti starter med `/` og ≤ 200, user agent 1–500, skærmbredde 1–20.000, svar 1–2000, ikke dublet af sig selv, `duplicate_of_id` kun ved status `DUPLICATE` (envejs), teknisk info kun ved `BUG`. Index på `(status, created_at)`, `created_by_id` og `duplicate_of_id`. | §15.4: databasen beskytter invarianterne, også mod scripts og håndskrevet SQL. Envejs-reglen gør, at SET NULL ved en slettet original aldrig bryder en CHECK (E28). | §11 Feedback v2 |
| D-142 | 2026-10-16 | `APP_ADMIN_EMAILS` parses i `parseEnv`: split på komma, trim, tomme poster droppes, lowercase, dubletter fjernes, hver post valideres med `z.email()`. En ugyldig post stopper opstarten (`APP_ADMIN_EMAILS: «foo» er ikke en gyldig email`); tom liste i produktion giver en advarsel. `src/env.ts` eksporterer `appAdminEmails`. `isAppAdmin(email, adminEmails)` er ren (præcist match efter trim og lowercase) og ser aldrig på en klubrolle. Kontoen skal oprettes, før emailen sættes i listen. | En tastefejl ville ellers stille efterlade appen uden app-admin. Signup verificerer ikke emails (D-029), så en adresse på listen uden konto kan registreres af hvem som helst; at registrere først lukker hullet (TG-060). | – |
| D-143 | 2026-10-16 | `toFeedbackPagePath` (E26) er strammere end §9.9: ud over klub-segmentet (`/c/<hvad som helst>`) fjernes query og `#hash` (søgninger, `?token=`), `/join/<kode>` bliver `/join`, kun en sti med præcis ét `/` foran godtages (ingen `//`, `\`, styretegn eller URL'er), gentagne `/` samles, afsluttende `/` fjernes, og den skæres ved 200 tegn. Én funktion bruges i `newFeedbackHref`, i `/feedback/new`'s forudfyldning og i create-actionen, så klub-id'et aldrig når en URL, en formular eller databasen. En udfyldt sti, der ikke er en sti, giver feltfejlen "Skriv en sti, fx /calendar."; ved en idé ignoreres feltet. | Rapporter er synlige for alle brugere (§3.3). En invitationskode og en nulstillings-token er hemmeligheder, og en søgning kan afsløre klubdata. | §9.9 "Side" |
| D-144 | 2026-10-16 | 👍-tallet beregnes som 1 (forfatteren) + antal `FeedbackVote` (`feedbackVoteCount`) og gemmes aldrig; +1 bliver stående, når forfatteren sletter sin konto (vises som "Tidligere bruger", `getFeedbackAuthorName`). Statusgrupper: åbne = Ny, Planlagt, I gang; lukkede = Færdig, Afvist **og Dublet**. Sortering "Flest stemmer" = stemmer, så nyeste, så id. Listen viser højst 200, og "lignende rapporter" matcher mod de 300 nyeste (i browseren, `findSimilarFeedback`: ord på mindst 3 tegn, åbne først ved lighed, højst 3). | §3.4. En dublet er afsluttet: arbejdet ligger på originalen. Fælles for appen, så en slettet konto er en tidligere *bruger*, ikke et tidligere medlem. | §9.9 "lukkede = Færdig og Afvist" |
| D-145 | 2026-10-16 | Rettigheder og atomicitet: alle logget-ind brugere ser og opretter; 👍 alle undtagen forfatteren (også app-admins); ret/slet forfatteren mens `NEW` eller app-admin; status, svar, dublet og teknisk info kun app-admin. En manglende rettighed er `FORBIDDEN` (rapporterne er offentlige), kun et ukendt id er 404. Ret/slet er én betinget `updateMany`/`deleteMany` (`WHERE id AND created_by_id AND status = 'NEW'`), og 0 rækker læses igen som `not-found`/`locked`/`forbidden`. 👍 er én `INSERT … SELECT … WHERE created_by_id IS DISTINCT FROM mig ON CONFLICT DO NOTHING`. Moderation: én transaction under `lockFeedbackRows` på rapporten og originalen; originalen skal findes og må ikke selv være en dublet (ingen kæder eller cykler ved markeringen); andre statusser rydder `duplicateOfId`; stemmer flyttes aldrig (E28). Teknisk info vælges kun i forespørgslen for app-admins, og user agent læses fra requesten på serveren (kun ved `BUG`, ≤ 500). 10 rapporter pr. bruger pr. døgn. | Skjulte knapper er kun UX (§4.4). Betingede skrivninger gør en samtidig statusændring sikker uden låse; låsen ved moderation holder originalen fast, til dubletten er skrevet. | – |
| D-146 | 2026-10-16 | `scripts/list-feedback.ts` (`npm run feedback:list`) læser kun (`findMany`/`count`) med sin egen Prisma-klient. Guards: aldrig på Vercel, en database, der ikke er lokal, kræver `--remote` – men **ingen** TTY-bekræftelse (afviger fra sangbogsimporten, D-126), fordi intet skrives. Målet udskrives altid først med maskeret password (på stderr ved `--json`). Teknisk info kun med `--with-tech`. Forfattere som visningsnavn, aldrig email. Brugertekst udskrives med styretegn erstattet (`terminalSafe`), så en rapport aldrig kan sende escape-sekvenser til terminalen. | Agenten skal kunne læse produktionens backlog uden et menneske ved tastaturet, men aldrig ved et uheld. | – |
| D-147 | 2026-10-18 | Feedbackens ramme: `src/app/feedback/layout.tsx` er read-only (kalder kun `requireUser` og `getUserClubs`) og viser AppShell for `lastActiveClubId`, så længe brugeren er medlem, ellers den første klub. `nav-items.ts` markerer Profil aktiv på `/feedback` (`alsoActiveOn`); der er intet hovedpunkt. Uden klubber: `FeedbackShell` (CenteredShells olivenbånd og logo → "/", en kolonne på `max-w-2xl`, "← Tilbage" til "/" og "Logget ind som …"). Footeren `SignedInFooter` har fået linket "Feedback" (ikke i FeedbackShell selv). Profil har en egen liste `<nav aria-label="Feedback">` under "Klubber". Feedbacksiderne kalder aldrig `requireClubPage`/`rememberActiveClub`. | §9.9: indgangen er Profil, så rammen og den aktive fane skal følge med. Feedback ændrer ikke den aktive klub. En bruger uden klubber har ingen Profil, men kan finde footeren. Listen "Klubber" bevares, fordi E2E vælger den. | – |
| D-148 | 2026-10-18 | Feedbackens ruter efter D-065: ingen `loading.tsx` direkte i `src/app/feedback/`; `(list)/` og `new/` har loading; `[feedbackId]/layout.tsx` er guard (`requireFeedback`: ukendt eller ugyldigt id → ægte 404) over `(detail)/loading.tsx`; `[feedbackId]/edit/` har ingen loading og giver ægte 404, når `canEditFeedback` er falsk (også for forfatteren, når rapporten ikke længere er Ny). `feedback/not-found.tsx` viser 404 inde i rammen med "Til feedbacklisten"; `feedback/error.tsx` beholder rammen. Rapporterne er offentlige, så en manglende rettighed er kun 404 på redigeringssiden; actions svarer `FORBIDDEN` (D-145). | Ægte HTTP 404 som for alle andre ressourcer (TG-008). En redigeringsside, man ikke må bruge, giver 404 som D-066. | – |
| D-149 | 2026-10-18 | "Findes den allerede?": siden `/feedback/new` sender `listSimilarCandidates()` (id, titel, status, 👍 for de 300 nyeste) som prop, og formularen kører den fælles rene `findSimilarFeedback` i browseren fra 3 tegn, 300 ms efter sidste tast, højst 3, i en høflig live region. Linkene åbner i en ny fane (`target="_blank" rel="noopener"`, sr-only "(åbner i en ny fane)"), så kladden ikke går tabt. | Øjeblikkeligt uden et request pr. tast, også på dårlig wifi (som sangbogen, D-123). Samme funktion på klient og server (§4.2). Grænsen står i TG-057. | – |
| D-150 | 2026-10-18 | "Rapportér denne fejl" vises kun på fejlgrænserne (`src/app/error.tsx`, `src/app/c/[clubId]/error.tsx`, `src/app/feedback/error.tsx`: `ReportErrorLink` med `usePathname()`; `global-error.tsx`: et almindeligt `<a>` stylet som outline-knap, hvis side læses fra `window.location` efter hydrering, ellers `/feedback/new?type=bug`), som outline ved siden af den primære "Prøv igen". Ikke på 404-sider, og ikke i `FormError` eller toasts. Linket bygges med `newFeedbackHref` (klub-id, query og hash fjernes, D-143), og fejlkoden kommer aldrig med i URL'en. | Afviger fra §9.9 v2 ("fejlsider (500-siden og generiske fejlbeskeder)"): en formularfejl er sjældent en appfejl ("Titlen skal være mindst 3 tegn."), og et link i hver fejlbesked ville støje. Fejlgrænserne er der, hvor appen reelt fejler. | §9.9 "Hvor finder man det?" (generiske fejlbeskeder) |
| D-151 | 2026-10-18 | "Skift email" på Profil (§9.8) for konti med password-login, som en egen Server Action (`changeEmailAction`), ikke Better Auths `user.changeEmail`, der forbliver slået fra. Felter: "Ny email", "Gentag ny email", "Nuværende password". Rækkefølge: id → Zod (`changeEmailSchema`: NUL fjernet, rå længde begrænset, så `emailSchema`: trim, ≤ 254, lowercase, gyldig; gentagelsen skal være ens) → medlemskab og session → rate limit 10/15 min pr. bruger (`email:change:user:<id>`) → kun med password-login (ellers "Du logger ind med Google, så din email følger din Google-konto.") → egen email afvises ("Det er allerede din email.") → `auth.api.verifyPassword` (10/15 min pr. IP på `/verify-password` i `authBeforeHook`; forkert → fejl ved feltet) → en adresse i `APP_ADMIN_EMAILS` får præcis samme svar som en email i brug → én `updateMany` (`changeUserEmail`: email lowercase, `emailVerified = false`; P2002 på `users_email_key` → "Den email bruges allerede af en anden konto.") → andre sessions og alle nulstillingslinks slettes (D-047), denne session bliver → app-skallen revalideres (sidebaren viser emailen) → Profil med "Din email er skiftet. Dine andre enheder er logget ud." Ingen cookies sættes i actionen (D-106). ~~Et Google-login på samme konto bevares (Better Auth finder Google-kontoen på dens id, ikke på emailen).~~ (Erstattet af D-165: et emailskift kobler Google fra.) | Jespers oprindelige §9.8/§16.1 har email i Settings; udskydelsen i D-106 var agenternes. Better Auths `changeEmail` uden verificering skifter med det samme, kræver intet password og ignorerer stille en email i brug. Afvejninger: (a) ingen bekræftelsesmail før SMTP og et domæne (TG-033); en tastefejl kan låse de andre enheder ude, men gentag-feltet fanger de fleste, denne enhed forbliver logget ind og kan rette det, og admin-nulstillingslinket virker stadig; (b) "bruges allerede" afslører en konto, men kun for en logget-ind, rate-limited bruger, der kender sit password; (c) at skifte til en andens ubrugte adresse har samme risiko som TG-002 (logger ejeren senere ind med Google, kobles Google på kontoen), se TG-064; (d) `changeEmail` forbliver slået fra. | §9.8 v2.13 ("Email vises kun"), del af D-106 |
| D-152 | 2026-10-18 | "Tilføj password" på Profil (§9.8) for rene Google-konti (Google, intet password) via `setPasswordAction` → `auth.api.setPassword` (kun server, ingen HTTP-sti). Friskhed: sessionens `createdAt` højst 10 minutter gammel (`isFreshLogin`, `SET_PASSWORD_FRESH_SECONDS`); ellers `REAUTH_REQUIRED`, og Better Auth kaldes aldrig. Siden afgør det samme på serveren og viser enten formularen eller forklaringen med [Log ind med Google igen] (`signIn.social` med `loginHint` = kontoens email, tilbage til Profil; kun når Google er konfigureret). Rækkefølge: id → Zod (`setPasswordSchema`) → medlemskab og session → har password ("Du har allerede et password. Brug 'Skift password'.") / hverken Google eller password (generisk fejl) → friskhed → rate limit 10/15 min pr. bruger (`password:set:user:<id>`) → `setPassword` (et kapløb mellem to faner giver `PASSWORD_ALREADY_SET`, samme tekst) → andre sessions og alle nulstillingslinks slettes, denne session bliver → Profil med "Dit password er gemt. Nu kan du også logge ind med email og password. Dine andre enheder er logget ud." D-046 er uændret: kontoen beholder sit Google-login, så admin-links stadig afvises. | Better Auths `setPassword` har intet friskhedstjek, og en Google-konto har intet password at bekræfte. Hver session på en ren Google-konto kommer fra et Google-login (email-login kræver et password, signup og nulstilling opretter et, admin-links afvises for Google-konti), og Better Auths sliding refresh ændrer aldrig `createdAt`. Accepteret: vælger man en anden Google-konto i vælgeren, logges man ind på den konto i stedet (Profil-linket giver så 404, hvis den konto ikke er medlem). | TG-034, del af D-106 |
| D-153 | 2026-10-18 | "Rediger afstemning": datoer, fælles starttid og steder kan rettes af opretteren (mens vedkommende er medlem) eller en admin, så længe afstemningen er åben, fristen ikke er gået, og den har **0 stemmesedler** – en databasetælling under `lockPoll`, så et tidligere medlems stemmeseddel også tæller. Samme regler som ved oprettelse: ≥ 2 valgmuligheder i mindst én kategori, højst 10 datoer og 10 steder, ingen datoer i fortiden, fristen i fremtiden og før den første nye dato; uden stemmer må fristen også rykkes tidligere (E24's "kun senere" gælder fra første stemme). Steder efter E5 (ikke arkiverede, ikke andre klubbers); "＋ Nyt sted" via `findOrCreatePlaceTx`, og en afvisning ruller stedet tilbage. Låserækkefølge som D-130: afstemning → stednavne (advisory) → steder FOR SHARE i id-orden (`lockPollPlacesTx`, delt med `createPoll`). Valgmulighederne diffes (`diffPollOptions`): fjernede slettes, nye oprettes med `clubId`, uændrede (samme tidspunkt eller sted) beholder deres id. Formularen sender et skjult `editOptions`; med det parses hele formularen af `pollFormSchema`, uden det kun tekster og frist (`options: null`). `castBallot` tager samme lås, så første stemme og en rettelse serialiseres: rettelsen svarer `options-locked` (CONFLICT, siden genindlæses skrivebeskyttet), eller den forældede stemmeseddel får `UNKNOWN_OPTION`. Seedet rører ikke en seedet åben afstemning, hvis valgmuligheder er rettet. Ingen skemaændring. | Genopretter §9.7.2 v2 ("Valgmuligheder kan ikke ændres, når første stemme er afgivet"), som agenterne indsnævrede i D-133 uden Jespers beslutning. Låsen, som alle skrivere af en afstemning allerede tager, fjerner kapløbet, D-133 ville undgå, og uden stemmesedler findes ingen stemmer, der kan forsvinde (`poll_votes → poll_options` er CASCADE). | D-133 |
| D-154 | 2026-10-18 | **Jespers instruks 2026-10-16:** "Lav end to end testen af applikationen. Tjek om der er flere features der mangler at blive lavet. Hvis ja lav dem inden end to end test." Gentaget 2026-10-18: "test det hele end to end, tjek om der er features der mangler fra den oprindelige plan". Gennemgangen af §16.1 (MVP-scope) mod koden fandt tre huller, der blev bygget før E2E: Feedback (§9.9; Q10: efter runde 4) manglede helt (D-141–D-150); "Settings: email, password" var udskudt af agenterne selv i D-106 (D-151 skift email, D-152 tilføj password for Google-konti); §9.7.2 v2's "valgmulighederne kan ændres, indtil første stemme er afgivet" var indsnævret af agenterne i D-133 (D-153). Ikke regnet som mangler: [SENERE]-punkter (fx feedbacksøgning, slet konto, upload af profilbillede, notifikationer), Jespers egne valg (ingen automatiske sangbogstests, D-119/TG-043; sangbogens tekster som de er, D-140) og det, der kræver SMTP og et domæne (bekræftelsesmail ved emailskift, TG-033). Derefter hele E2E-suiten (`npm run test:e2e`, desktop + 375 px, uden retries) og gates, indtil suiten var grøn to kørsler i træk. Hver fejl blev sporet til sin årsag: en appfejl rettes i appen med en test, der ville have fanget den; en skrøbelig test rettes i testen. Ingen assertion er svækket og ingen test sprunget over. En kørsel, som systemet afbrød (dvale), tæller ikke og køres om; fulde kørsler holder en `systemd-inhibit --what=idle`-lås (F-082). | Jesper vil have én samlet gennemgang, før klubben tager appen i brug. Agenternes egne udskydelser og indsnævringer er ikke Jespers beslutninger og blev vurderet mod hans oprindelige plan (§16.1). Resultat: ingen appfejl; skrøbelige tests i F-080 (`polls.spec.ts` alene) og F-081 (tre i den fulde suite). | – |
| D-155 | 2026-10-22 | Next.js 16.4.0 → 16.4.2 (samme major: ingen codemods, ingen migreringsguide), sammen med `@next/env` og `eslint-config-next`, der er pinnet til samme version. `next.config.ts` sætter `experimental.agentUpgrade: "security"` (findes siden 16.4.0): `next dev` og `next build` minder kun om opgraderinger, der retter en sikkerhedsadvisory, og det er standardpolitikken for `next upgrade --agent`. Ingen andre afhængigheder ændret. | 16.4.0 er ramt af tre advisories (`>=16.0.0 <=16.4.0`): GHSA-p3m5-59mp-jv5r (high, DoS i App Router via Server Actions, som appen bruger overalt), GHSA-2464-fhr4-w9xw (critical, RCE i Image Optimization-API'et med SVG; appen bruger ikke `next/image`, men `/_next/image` findes alligevel) og GHSA-673q-mjm6-r5xr (critical, RCE i `use cache`; bruges ikke, D-025). 16.4.2 har ingen kendte advisories. `security` er Next's standard, men sat eksplicit, så politikken står i konfigurationen. | – |
| D-156 | 2026-10-24 | **Importér fra PDF i appen** (Jesper 2026-10-24: "det skal også være muligt bare at sende en PDF ind til sangbogen i stedet for at skrive dem alle ind manuelt. Begge skal være muligt."; valgt: begge slags PDF'er, mange ad gangen med gennemsyn). Se §9.6. Serveren læser PDF'en med `unpdf` 1.8.1 (pdf.js' serverless-build; poppler findes ikke på Vercel). pdf.js' `getTextContent()` dropper runs med kun mellemrum, men ChordBanks tomme afstandsrække under en akkordrække er netop sådan en, så `src/server/songs/pdf-runs.ts` går operatorlisten igennem: hver `showText` er én run i pdftohtml's koordinater (px = 1,5 × punkter, top = grundlinje − ascent × størrelse), familien uden subset-præfiks og stil-suffiks, og runs på samme grundlinje i samme skrift med et mellemrum under én skriftstørrelse slås sammen som hos poppler. ChordBank-modulerne (`chordbank`, `rows`, `stanzas`, `clean`, `title`, `round-trip`, `to-stored-text`, `PdfRun`) er flyttet til `src/server/domain/songs/chordbank/`, `contentHash` til `src/server/domain/songs/import-hash.ts`; CLI'en importerer dem derfra og bruger stadig poppler. To Server Actions (`readSongPdfAction` pr. fil, `importSongsAction` pr. portion á 25), begge med medlemskab + `canManageSongs` og rate limit (300 læsninger og 60 importer pr. time pr. bruger). `importSongs` opretter med `createMany(skipDuplicates)` og overskriver eller sletter aldrig; `importHash` er hashen af sangen som læst, eller af det gemte, hvis de læste felter ikke bestod schemaet (`songs_import_pair_check`). `experimental.serverActions.bodySizeLimit` er 4,5 mb. Tests: D-119 fritager sangbogen for tests, men importen tager filer fra brugere og tjekker rettigheder, så den har unit-, integrations- og E2E-tests med opdigtede PDF'er; resten af sangbogen testes stadig manuelt. | Klubber uden ChordBank og nye sange senere skal kunne komme ind uden en udvikler og en terminal. Gennemsynet fanger det, en heuristik for ren tekst ikke kan gætte. Ét PDF pr. request holder sig under Vercels grænse på 4,5 MB og giver fremdrift. En PDF med hele sangbogen i én fil deles ikke op i sange (én sang pr. fil). | – |
| D-157 | 2026-10-24 | Loginformularens emailfelt har `autocomplete="username"` (stadig `type="email"`). Opret konto, glemt password og skift email beholder `autocomplete="email"`. **Udvidet samme dag** (Jesper: forslagene kom stadig ikke): browseren foreslår kun, hvad den har gemt for netop den adresse, og det er intet efter en ny installation eller en nulstillet database. Appen husker derfor selv de emails, der er brugt til login eller oprettelse på enheden (`localStorage` `olklubben.auth.emails`, højst 5, nyeste først, kun emails), og viser dem i feltets `<datalist>` og på loginsiden som knapper under feltet ("Brugt før:"; et tryk udfylder emailen og flytter fokus til password). Emailen gemmes ved afsendelse og fjernes igen, hvis serveren afviser (forkert password, email i brug), så en tastefejl aldrig foreslås. | Jesper: "emailfeltet skal foreslå de emails, man har brugt". Browserens password-manager foreslår gemte logins i feltet, der er markeret som brugernavn i en loginformular; `email` foreslår kun adresser fra browserens profil. | – |
| D-158 | 2026-10-24 | **Billede af øllen** (Jesper 2026-10-24: "på siden, hvor man tilføjer en øl (til eventet som standard), skal man også kunne tilføje et billede af den"), hentet frem fra §9.5's [SENERE]. Se §9.5. Lagring i Postgres: tabellen `beer_images` (1:1 med `beers`, sammensat FK `(beer_id, club_id)` → `beers(id, club_id)` med CASCADE, så billedet altid er i øllens klub, D-096; CHECKs: `image/webp`, ≤ 1 MB, ≤ 1200 × 1200 px). Behandling med `sharp` 0.35.5 (allerede installeret via Next, nu en direkte afhængighed): `rotate()`, `resize(fit: inside)`, WebP kvalitet 80, metadata fjernes. Browseren gør billeder over 1,5 MB mindre (længste side 2000 px, JPEG) før upload. React nulstiller formularen efter hvert svar fra serveren (F-053), så feltet holder filen i state og lægger den tilbage i `<input type=file>` med `DataTransfer`; billedet følger derfor med ved "Tilføj alligevel". Billedet behandles før dublettjekket, så en ulæselig fil vises ved feltet med det samme. Ruten (`route.ts`) slår billedet op med ét query, der kræver medlemskab af klubben, og svarer `Cache-Control: private, max-age=31536000, immutable`; URL'en bærer billedets `updatedAt`, så et nyt billede får en ny URL. Listerne henter kun `updatedAt`, aldrig bytes. | Ingen ny tjeneste at sætte op på Vercel (Blob kræver en integration og offentlige URL'er; et billede i en privat klub skal bag medlemskab ligesom resten, §4.4). En øl får højst ét billede på ca. 50–200 KB, så Neons lager rækker langt. | §9.5 [SENERE] "billede" |
| D-159 | 2026-10-24 | "Log ud" står i desktop-sidebaren under brugerrækken (Jesper: "så man ikke skal gå til profil for at logge ud"). Samme `LogoutButton` som på Profil (variant `sidebar`: en række i sidebarens stil med `LogOutIcon` på avatarens plads). Mobilens bundmenu er uændret; Log ud er stadig på Profil. E2E-hjælperen `logOut()` klikker knappen i `<main>`, da Profil på desktop nu har to. | Ét klik i stedet for to, uden at give log ud en plads i hovedmenuen. | – |
| D-160 | 2026-10-24 | Oprydning efter /simplify (Jesper: "use /simplify on all the isolated components"). Ændret adfærd: (a) øl-billedet behandles først, når dublettjekket er bestået: har navnet en dublet og filen er ulæselig, vises dublet-advarslen først og billedfejlen efter "Tilføj alligevel"; (b) kortene i kataloget og på eventsiden henter `?size=thumb` (112 × 112 WebP, beskåret til midten, lavet med `sharp` i ruten og cachet privat i et år) i stedet for hele billedet; (c) browseren skalerer til 1200 px (det, serveren gemmer). Mekanisme: `useAfterServerAnswer(actionState, restore)` i `src/components/features/forms/` er den ene måde at genoprette en kontrol efter Reacts form-reset (F-053, TG-037: aldrig ved mount); `useActionForm` fik `onValidSubmit`. Resten er uden adfærdsændring (se §19.2). | Én mekanisme i stedet for tre, og en liste med 30 øl henter ca. 30 × 4 KB i stedet for 30 × 150 KB. | – |
| D-161 | 2026-10-24 | `.fallowrc.json` (fallow 3.35) med kun `entry` for `tests/integration/**/*.itest.ts` og `tests/integration/global-setup.ts`; ellers fallows standarder. `fallow audit --base <før ændringen>` bruges som kvalitetstjek af en ændring (Jesper: "see if anything there can be improved with the fallow audit command"); CRAP-fund uden coverage-data er advarsler, ikke fejl at jagte. | Uden entry-mønstret melder fallow alle integrationstests som ubrugte filer, så hver ny itest fejler auditten. | – |
| D-162 | 2026-10-25 | Nyt mærke (Jesper sendte et ikon med to ølglas, der skåler: "mere som det her, men med den identitet, der allerede er"). Koøjet bevares (olive skrog, messingring med fire bolte, havneblåt glas med refleks); ølkruset er erstattet af to pintglas, der klinker (±17°), med skum og tre gnister i `--amber-light`. Et omrids i glassets blå skiller glassene, hvor de rører hinanden, så de også læses ved 32 px. Samme tegning i `src/components/brand/logo.tsx` (`LogoMark`), `src/app/icon.svg` og `src/app/apple-icon.png` (180 px, genereret fra SVG'en med `sharp`). | Skål er klubbens øjeblik; koøjet og farverne er det, man allerede genkender appen på (§13.1, §13.2). | – |
| D-163 | 2026-10-25 | Klubsiden i sektioner, invitationen kun dér, diskret skillelinje (Jesper sendte et skærmbillede af Overblikkets kort: "that is the card i want on the club page and removed from the overview page"). (a) Overblik viser ikke længere "Inviter dine ølbrødre", heller ikke i en klub med ét medlem; D-057/D-079 er forældede, og `PollCard.quiet`/`NoEventsState.deemphasize` er fjernet. (b) Klubsiden bruger præcis det kort (`InviteSection`: `Card` med amber kant, samme overskrift og tekst, `InviteShare` med billetnotcher i kortets farve, [Generér ny kode] nederst for admins). Rækkefølge: Medlemmer · Steder · invitationskortet · Farezone, med en tynd linje imellem. (c) Medlemmer: admins først (uændret sortering), den sidste admin-række har en kraftigere bundlinje (`border-b-2 border-olive/25`), så medlemmerne alfabetisk; stadig én liste. (d) Steder er en sektion med overskrift; rækkens titel er nu antallet ("3 steder"). (e) Rebet og bølgelinjen er erstattet af én 1px-linje i `--border` i hele appen (`SectionDivider`, `rope-line`/`wave-line` fjernet). | "Rebet" fyldte for meget; en stille linje lader indholdet tale. Invitationen hører til klubben, og Overblik handler om næste ølsmagning (§3.2). | §7.2, §9.1, §9.8, §13.1, D-057, D-079 |
| D-164 | 2026-10-26 | Appens base-URL (invitationslinks, nulstillingslinks, Better Auths `baseURL`) er på Vercel Production `https://${VERCEL_PROJECT_PRODUCTION_URL}` og kommer ikke længere fra en håndsat `BETTER_AUTH_URL`. `BETTER_AUTH_URL` er kun påkrævet uden for Vercel Production; er den sat og anderledes i produktion, ignoreres den med en advarsel. `VERCEL_PROJECT_PRODUCTION_URL` valideres som et rent domænenavn. (`parseEnv().appBaseUrl`, `src/lib/app-url.ts`.) | Jespers invitationslink åbnede Vercels "Deployment has failed" (F-085): en håndsat URL kan pege på ét bestemt (fejlet) deploy. Vercels egen variabel peger altid på produktionsdomænet og følger med, når der kommer et eget domæne (TG-001). Kommer fra Vercel, ikke fra `Host`-headeren, så links ikke kan forfalskes. | §4.8, F-085 |
| D-165 | 2026-10-26 | Google-login slås sikkert til (Jesper: "nemt og hurtigt og SIKKERT"), **uden Auth0**. (a) Ingen automatisk kobling: `disableImplicitLinking: true`, `requireLocalEmailVerified` fjernet; en eksisterende konto får `account_not_linked` og forbinder Google på Profil (`authClient.linkSocial`, kortet "Google-login", §9.8). (b) `databaseHooks.account.create.before` for Google: tokenets email skal være bekræftet (`email_not_verified`) og være kontoens nuværende email (`email_does_not_match`); hooket kaster, så hele oprettelsen rulles tilbage. (c) "Skift email" sletter Google-login'et i samme transaction (`changeUserEmail` → `{ email, unlinkedGoogle }`, toast `email-changed-google`); dele af D-151 ("Google-login bevares") er forældede. (d) `account.create.after` bekræfter emailen ved eksplicit kobling. (e) App-admin kræver en bekræftet email (`getFeedbackViewer`). (f) `disabledPaths` (5 ubrugte endpoints), `disableIdTokenSignIn`, `encryptOAuthTokens`, rate limit `/link-social` 10/min. (g) Faste fejltekster pr. kode i `getOAuthErrorMessage`. | Auth0 kræver alligevel en egen Google OAuth-klient i produktion og ville være et ekstra led, der ser alle logins. Password-konti verificerer ikke email (D-029), så automatisk kobling (TG-002) og "forbind Google, skift så email" (TG-064, fundet af et uafhængigt sikkerhedsreview af planen) ville lade en angriber beholde adgangen til en konto på offerets adresse. Kun et bekræftet ejerskab af emailen må give Google-login og app-admin. | §4.7, §6.2–6.4, §9.8, §9.9, E19, D-029, D-151, TG-002, TG-003, TG-060, TG-064 |
| D-166 | 2026-10-28 | **Auth0 Universal Login** (Jesper: "universal login, de samme folk som andre steder", knaptekst "Fortsæt med Auth0", kun Auth0-knappen, log ud også fra Auth0). (a) Better Auth `genericOAuth` med `auth0()` + `requireIdTokenVerification: true` (uden brugbar discovery registreres udbyderen ikke) og `endSessionEndpoint` `/oidc/logout`; Auth0 bruger de samme kerne-endpoints som Google, så D-165 gælder uændret. **Fravalgt: `@auth0/nextjs-auth0`** (Auth0-skillens standard): eget sessionssystem og egne `/auth/*`-ruter ved siden af Better Auth, som al autorisation, club isolation og rate limits bygger på. (b) `externalProvider` = `auth0` › `google` › `null`; Google registreres ikke, når Auth0 er sat op. (c) Account-hooks gælder alle udbydere undtagen `credential` (ukendte fejler lukket); for Auth0 kun `sub` med `google-oauth2|` eller `auth0|` (`connection_not_allowed`). (d) `authBeforeHook`: id-token fra klienten afvises på alle stier, `scopes`/`additionalParams` på login-endpoints undtagen `{ prompt: "login" }`. (e) Generelle eksterne logins: `getAccountLogins → { hasPassword, external }`, `changeUserEmail` sletter alle ikke-`credential`-konti (`email-changed-external`), tekster med udbyderens navn (`EXTERNAL_PROVIDERS`, `emailFollowsExternal`, `getOAuthErrorMessage(code, label)`). (f) "Tilføj password" for Auth0 kræver også, at `auth_time` i det gemte id-token er under 10 minutter; "Log ind med Auth0 igen" sender `prompt=login`. (g) "Log ud" følger Auth0's logout-URL én gang (`disableRedirect`). | Én Auth0-identitet på tværs af Jespers apps, uden at åbne nye veje ind: en delt tenant kan have forbindelser og M2M-klienter, der påstår `email_verified`, og Auth0's SSO og lange id-tokens må hverken erstatte et rigtigt login eller kunne genbruges. Sikkerhedsreview af planen (uafhængig agent mod better-auth 1.7.7) fandt M1 og L1–L7; alle er indarbejdet. | §4.1, §4.7, §4.8, §6.2, §9.8, D-165 |

## 19.4 Fejl og rettelser (implementeringslog)

Skabelon. Kopiér for hver ny post. Nyeste øverst.

```markdown
### F-XXX · ÅÅÅÅ-MM-DD · <kort titel>
- **Område:** (fx Auth / Events / Polls / DB / UI / Deploy)
- **Symptom:** Hvad skete der? (fejlbesked, forkert adfærd)
- **Årsag:** Hvorfor skete det?
- **Rettelse:** Hvad blev ændret? (filer/commits)
- **Læring / forebyggelse:** Hvad skal næste session vide? Skal spec'en opdateres?
```

### F-086 · 2026-10-26 · Sikkerhedsreview af Google-planen fandt et hul, planen ikke lukkede
- **Område:** Auth
- **Symptom:** Første plan (ingen automatisk kobling) lukkede TG-002, men et uafhængigt review mod Better Auth 1.7.7-kilden viste, at TG-064 overlevede: forbind din egen Google, skift så kontoens email til offerets (D-151 bevarede Google). Efter offerets "Glemt password" kunne angriberen stadig logge ind med Google. Race-varianten: start "Forbind Google" med den gamle email, skift email, afslut hos Google; callback'en sammenligner med emailen, der blev frosset i OAuth-state.
- **Årsag:** En Google-konto blev bundet til brugerens id, ikke til den email, Google havde bekræftet. `/security-review`-skillen kunne ikke køre på en plan (den kræver `git diff origin/HEAD...`), så reviewet blev lavet af en separat agent.
- **Rettelse:** D-165 (b)–(c): "Skift email" sletter Google-login'et i samme transaction, og `account.create.before` afviser en Google-konto, hvis email ikke er kontoens nuværende. Mutationstest: hver af de fem beskyttelser fjernet én ad gangen → præcis én test i `google-oauth.itest.ts` fejler. Den første id-token-test bestod også uden `disableIdTokenSignIn` (det usignerede token faldt på Googles signaturtjek); den påstår nu 404 `ID_TOKEN_NOT_SUPPORTED`.
- **Læring / forebyggelse:** Et database-hook, der kaster i link-flowet, bliver ikke til en redirect (Better Auth fanger kun fejl i login-flowet), så race-varianten ender på et JSON-fejlsvar i stedet for Profil. Det sker kun ved et angreb og er accepteret. Brug mutationstest, når en test skal bevise en sikkerhedsindstilling.

### F-085 · 2026-10-26 · Invitationslinket åbnede Vercels "Deployment has failed"
- **Område:** Deploy / Invitationer
- **Symptom:** Jesper åbnede invitationslinket fra Klubben og fik Vercels side "Deployment has failed" i stedet for join-siden.
- **Årsag:** Linket er `BETTER_AUTH_URL + /join/<kode>`, og `BETTER_AUTH_URL` var sat i hånden i Vercel. Alle de seneste `master`-deploys var lykkedes (GitHub commit-status), men på `5055a15` lå et fejlet deploy (`dpl_6pr4dZRNr1rUSLfaRPgdAUNNWkUt`). Bekræftet 2026-10-28: en fejl-redirect fra Better Auth i produktion (`/api/auth/callback/google?code=x&state=y` → `302 https://olklubben-bpuzvw075-jespers-projects.vercel.app/login?error=state_mismatch`) viser, at `BETTER_AUTH_URL` var en deploy-URL. Deploy-URL'er er låst bag Vercel-login (Deployment Protection), så gæster blev sendt til Vercels login, og logget ind hos Vercel så man "Deployment has failed". Projektets domæne er `olklubben-six.vercel.app` (`olklubben.vercel.app` er en fremmed Nuxt-side). Samme fejl ramte nulstillingslinks og Better Auths trustedOrigins.
- **Rettelse:** D-164: på Vercel Production bruges `VERCEL_PROJECT_PRODUCTION_URL` (`src/lib/env-schema.ts`, `src/env.ts`, `src/lib/app-url.ts`, 5 nye unit tests). README og `.env.example`: sæt ikke `BETTER_AUTH_URL` i Production.
- **Læring / forebyggelse:** Absolutte URL'er til appen må aldrig afhænge af en håndkopieret deploy-URL. Gæt ikke projektets domæne ud fra projektnavnet; se Vercel → Settings → Domains.

### F-084 · 2026-10-24 · "Log ind med Enter virker ikke" kunne ikke genskabes
- **Område:** Auth / UI
- **Symptom:** Jesper (localhost, Chrome): Enter i loginformularen logger ikke ind.
- **Årsag:** Ikke fundet. Formularen har én `type="submit"`-knap, og `useActionForm` stopper kun et submit med klientfejl. I headless Chromium sender Enter i både email- og passwordfeltet samme POST som et klik, og en E2E-kørsel (opret konto → log ud → skriv email og password → Enter) lander i klubben. Mulige forklaringer: Chromes autofyld-menu var åben (første Enter vælger forslaget), eller testbrugerens password var et andet end antaget (seed-brugernes password svarede "Forkert email eller password" ved både klik og Enter).
- **Rettelse:** Ingen kodeændring for Enter. Emailfeltet fik `autocomplete="username"` (D-157).
- **Læring / forebyggelse:** Spørg efter præcise trin (felt, autofyld, hvad der sker), før adfærd der virker i testene, ændres.

### F-083 · 2026-10-22 · Kommandoer arvede `NODE_ENV=development` og `.env.local` fra den kørende dev-server
- **Område:** Tooling / Build / Tests
- **Symptom:** Under opgraderingen til Next 16.4.2 (D-155) fejlede `next build` med "Error occurred prerendering page "/_global-error" … TypeError: Cannot read properties of null (reading 'useContext')" efter et væld af "Each child in a list should have a unique "key" prop" og advarslen "non-standard NODE_ENV". `npm run test:e2e` stoppede i `e2e/test-env.ts`: "DATABASE_URL peger på databasen "olklubben_dev"".
- **Årsag:** Agent-sessionen var startet af opgraderingspåmindelsen i Jespers kørende `pnpm run dev` (`next dev` → `pnpm dlx next@canary upgrade` → agenten), så shellen havde arvet dev-serverens miljø: `NODE_ENV=development`, `NEXT_RUNTIME`, `__NEXT_PROCESSED_ENV`, canary-pakken i `NODE_PATH` og forrest i `PATH` og alle variabler fra `.env.local` (`DATABASE_URL`, `BETTER_AUTH_SECRET`, SMTP, Google). `next build` med `NODE_ENV=development` prerenderer med Reacts dev-build og fejler. Variabler i shellen vinder over `.env.test` (`@next/env`), så E2E fik dev-databasen. Ikke en fejl i 16.4.2.
- **Rettelse:** Ingen kodeændring. Alle gates kørt igen under `env -i HOME=… PATH=<uden pnpm dlx> USER=… LANG=… TERM=…`. Garderne virkede: E2E afviste `olklubben_dev`, før noget forbandt, og integrationstestene udskifter altid databasenavnet med `olklubben_itest` (`tests/integration/env.mts`), så dev-databasen blev ikke rørt.
- **Læring / forebyggelse:** Er en build- eller testfejl mærkelig, så tjek `env` for arvede `NODE_ENV`, `NEXT_*`, `__NEXT_*` og `DATABASE_URL`, før du jagter fejlen i koden. Er sessionen startet af et værktøj (fx `next upgrade --agent`), så kør gates med et rent miljø. Dev-serveren, der startede sessionen, er dens forælder: genstart den bagefter, ellers kører den stadig den gamle version.

### F-082 · 2026-10-18 · Maskinen gik i dvale midt i en fuld E2E-kørsel
- **Område:** Tests / Tooling
- **Symptom:** Kørsel 3 af hele suiten: 5 røde tests i filer, der har været grønne i mange kørsler (`password-reset`, `places`, `poll-lifecycle`, `overview-calendar`): "Noget gik galt – prøv igen" i en dialog, signup, der blev stående på `/signup`, `net::ERR_NETWORK_IO_SUSPENDED` ved `page.reload()` og en test, der hang til timeout uden en ventende Playwright-handling. Serverens tidsstempler sprang fra 16:05 til 17:18 UTC i en kørsel, Playwright målte til 7,1 minutter, og browseren gav derefter "Failed to execute 'measure' on 'Performance' … negative time stamp" (F-070) på hver side.
- **Årsag:** Systemet gik i dvale kl. 18:05:57 og vågnede kl. 19:17:59 (`journalctl`: "The system will suspend now!", ingen låg- eller tænd/sluk-hændelse, altså GNOMEs automatiske dvale ved inaktivitet). De fire tests, der var i gang, mistede deres forbindelser; testen bagefter hang.
- **Rettelse:** Kørslen er kasseret og ikke talt med. De to næste fulde kørsler kørte under `systemd-inhibit --what=idle --mode=block --who="Ølklubben E2E" npm run test:e2e`, der kun blokerer automatisk dvale, mens kommandoen kører (en bevidst dvale virker stadig, og låsen slippes, når kommandoen slutter): 214/214 begge gange.
- **Læring / forebyggelse:** Røde tests i mange uafhængige, normalt stabile filer på én gang er et miljøtegn: tjek `journalctl` for dvale, før du jagter fejl i koden. Kør lange fulde E2E-kørsler med en idle-lås.

### F-081 · 2026-10-18 · Tre skrøbelige tests, som den fulde E2E-suite fandt (ingen appfejl)
- **Område:** Tests
- **Symptom:** (a) `poll-lifecycle.spec.ts` "annullér med bekræftelse" (desktop): annulleringsdialogen åbnede ikke anden gang, og testen ventede til timeout. Databasen viste afstemningen som `CANCELLED`, selv om testen aldrig nåede at bekræfte. (b) `polls.spec.ts` "stem, ret stemmen, og «Ingen af datoerne passer mig»" (mobil): opretteren så stadig medlemmets første stemmeseddel (to datoer), selv om databasen bagefter havde `no_date_works = true`. (c) `poll-lifecycle.spec.ts` "Kalender viser «Mulig dato»" (mobil): "strict mode violation", to links til afstemningen i dagspanelet.
- **Årsag:** (a) Udløseren og dialogens bekræftelsesknap hedder begge "Annullér afstemning". Mens dialogen lukker (exit-animationen), skjuler Radix stadig resten af siden for tilgængelighedstræet, så den sidevide locator fandt den lukkende dialogs bekræftelsesknap og annullerede afstemningen. (b) Toasten "Skål! Din stemme er gemt ✓" fra den første gemning stod der stadig (samme tekst og id), så testen gik videre, før den anden gemning var gemt, og opretterens side blev hentet for tidligt. (c) Dagspanelet læser `?day` i browseren; lige efter URL-skiftet viser det stadig hele måneden (begge datoer), og en strict-mode-fejl i `expect` prøves ikke igen. Testen klikkede desuden "den første dag med 1 mulig dato" (TG-053's note).
- **Rettelse:** (a) Udløseren findes inde i sin region (`getByRole("region", { name: "Styr afstemningen" })`), og testen venter, til dialogen er væk, før den tjekker status og åbner igen. (b) Testen venter, til formularen er genmonteret på den gemte stemmeseddel ("Ikke gemt endnu" er væk, "Du har stemt ✓" vises), før den går videre. (c) Testen trykker på dagen med dens fulde navn (`dayButtonLabel`) og venter på præcis ét link i panelet med dagens overskrift (`toHaveCount(1)`). Hver rettelse er kørt 4–5 gange i begge projekter og derefter i to fulde kørsler.
- **Læring / forebyggelse:** Find en udløser inde i sin region, når dialogen har en knap med samme navn. Brug aldrig en toast som bevis for en *gentaget* gemning; vent på en tilstand, der kun findes efter svaret. Når en locator kan matche flere elementer i en overgang, så brug `toHaveCount` (prøves igen) før `toBeVisible`.

### F-080 · 2026-10-18 · Runde 4's `polls.spec.ts` fejlede ved første kørsel
- **Område:** Tests
- **Symptom:** 3 tests × 2 projekter røde, første gang `e2e/polls.spec.ts` blev kørt (batch 4, D-153).
- **Årsag:** (a) Etiketten "Planlæg" gav en email med "æ" (F-078-klassen); (b) en førende datos tilgængelige beskrivelse starter med "Fører. ", testen forventede "1 kan: …"; (c) `getByText(<frist>)` ramte også "Du kan stemme indtil …" (strict mode).
- **Rettelse:** ASCII-etiket, regex med "Fører. " og `exact: true` i `e2e/polls.spec.ts`.
- **Læring / forebyggelse:** E2E skrevet uden kørsel har locator-fejl. F-078-reglen gælder alle etiketter, der ender i `newUser` (også via `clubWithMember`).

### F-079 · 2026-10-18 · To "Nuværende password"-felter på Profil
- **Område:** Tests / UI
- **Symptom:** Med "Skift email" fik Profil et andet felt med etiketten "Nuværende password", så `page.getByLabel("Nuværende password")` i `profile.spec.ts` og `form-focus.spec.ts` ville ramme to elementer (Playwrights strict mode).
- **Årsag:** Testene ledte på hele siden. Etiketten er rigtig i begge kort.
- **Rettelse:** Profilens email- og passwordkort er regioner navngivet efter deres overskrift (`role="region"` + `aria-labelledby`), og testene leder inde i kortet (`getByRole("region", { name: "Skift password", exact: true })`).
- **Læring / forebyggelse:** Når en side har flere formularer med samme feltnavne, så giv hver sin navngivne region og find felterne inde i den.

### F-078 · 2026-10-18 · E2E-brugere med æ/ø/å i etiketten fik en ugyldig email
- **Område:** Tests
- **Symptom:** To feedback-tests (i begge projekter) blev hængende på `/signup` ("Skriv en gyldig email, fx navn@example.com.").
- **Årsag:** `newUser(testInfo, label)` bygger emailen af etiketten (`e2e-<label>-…@example.test`), og etiketterne "rapportør" og "klubløs" gav en email med "ø", som signup (med rette) afviser.
- **Rettelse:** ASCII-etiketter ("rapporter", "klubloes") i `e2e/feedback.spec.ts`.
- **Læring / forebyggelse:** Etiketten til `newUser` er en del af en email: kun a–z, tal og bindestreg. Danske ord hører til i navne og titler.

### F-077 · 2026-10-16 · JS-længder i UTF-16-enheder ville ramme CHECKs med en minimumslængde
- **Område:** Validering / DB
- **Symptom:** (Fundet under design af feedback, før det ramte.) En titel som "🍺🍺" er 4 lange i JavaScript (`.length`), men 2 tegn for Postgres' `char_length`. Med `.min(3)` i Zod ville den passere formularen og så fejle på `feedback_title_length_check` med den generiske fejl.
- **Årsag:** `String.length` tæller UTF-16-enheder, CHECKs tæller kodepunkter. For maksimumslængder er JS bare strammere; for minimumslængder over 1 bliver de uenige.
- **Rettelse:** `src/lib/validation/feedback.ts` tæller kodepunkter (`[...value].length`) for både min og max, efter rensning (NFC). Testet med emoji i `feedback-validation.test.ts`. Under arbejdet afkodede shell-heredocs igen `\uXXXX` til bogstavelige tegn (F-057); testen blev genskrevet med escapes.
- **Læring / forebyggelse:** En ny minimumslængde > 1 skal tælle kodepunkter. Skriv filer med `\u`-escapes med Write-værktøjet, ikke en heredoc.

### F-076 · 2026-10-14 · Et `::before`-flueben kom med i checkboksens tilgængelige navn
- **Område:** UI / Tilgængelighed
- **Symptom:** I afstemningsformularen hed et afkrydset sted "✓ Hos Mads" for skærmlæsere og Playwright (`ariaSnapshot`), så locators med det præcise navn fejlede, så snart boksen var krydset af.
- **Årsag:** CSS-genereret indhold (`content: '✓'`) på et `<label>` indgår i beregningen af det tilgængelige navn. Desuden gjorde `before:rounded-md` (0,8 × `--radius`) den 20 px store boks næsten rund, så den lignede en radio.
- **Rettelse:** `peer-checked:before:content-['✓'_/_'']` (CSS-indhold med tom alt-tekst) og `before:rounded-[5px]` i `src/components/features/events/place-choice-card.tsx`. Verificeret med `ariaSnapshot`: `checkbox "Hos Anders" [checked]`.
- **Læring / forebyggelse:** Dekorativt pseudo-indhold på en label skal have tom alt-tekst (`content: 'x' / ''`) eller ligge i et `aria-hidden`-element.

### F-075 · 2026-10-14 · `prisma migrate diff --from-migrations` kræver en shadow-database
- **Område:** DB / Tooling
- **Symptom:** Designets drift-tjek (`prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script`) fejlede, fordi `prisma.config.ts` ikke har `datasource.shadowDatabaseUrl`.
- **Årsag:** Prisma 7 skal afspille migrationerne i en shadow-database for at sammenligne dem med schemaet.
- **Rettelse:** Drift-tjekket køres som `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` mod dev-databasen med alle migrationer anvendt. Det skal give en tom migrering ("This is an empty migration").
- **Læring / forebyggelse:** Brug den kommando ved hver migrering, indtil der er sat en shadow-database op. Et partielt index (som `poll_votes_ballot_id_place_key`) giver ingen drift, når det er erklæret i schemaet (F-004).

### F-074 · 2026-10-13 · Et absolut positioneret grid krympede til sin `<summary>`
- **Område:** UI (sangbogens A–Å-gitter)
- **Symptom:** Gitteret med `grid-cols-6` blev 44 px bredt og bogstaverne lå oven i hinanden.
- **Årsag:** `minmax(0,1fr)`-spor i et absolut positioneret element regnes ud fra den indholdende blok, her `<summary>`-knappen.
- **Rettelse:** `w-max` og faste spor (`grid-cols-[repeat(6,3rem)]`) i `song-letter-grid.tsx`.
- **Læring / forebyggelse:** Popover-grids skal have faste spor og `w-max`.

### F-073 · 2026-10-13 · Rigtige sangtitler og en tekstbid i kodekommentarer
- **Område:** Privatliv
- **Symptom:** Titel-grep'en fandt en rigtig titel som eksempel i en kommentar i `search.ts` (fra en afbrudt kørsel) og senere rigtige titler og en tekstbid i doc-kommentarer i `scripts/songbook/title.ts` og `anomalies.ts`.
- **Årsag:** Agenterne brugte designets eksempler (rigtige sange) i kommentarer.
- **Rettelse:** Erstattet med opdigtede eksempler. Grep'en giver 0 træf.
- **Læring / forebyggelse:** Også eksempler i kommentarer skal være opdigtede. Kør titel-grep'en ved hver gate (§19.1 punkt 10).

### F-072 · 2026-10-13 · Bogstavelig U+2028/U+2029 i en regex gav en syntaksfejl
- **Område:** Tooling / Domæne (sangbog)
- **Symptom:** `song-text.ts` kunne ikke parses: "Unterminated regular expression".
- **Årsag:** Samme klasse som F-057: værktøjet afkodede `\u2028`/`\u2029` til bogstavelige tegn, og de er linjeskift i JavaScript, også inde i en regex-literal. Det samme skete med nul-bredde-tegn i importens `clean.ts`.
- **Rettelse:** Alle usynlige tegn skrevet som escapes i `song-text.ts` og `scripts/songbook/`.
- **Læring / forebyggelse:** Skriv en backslash via `chr(92)` i et Python-hjælpescript, og tjek med `grep -rnP '[\x{00a0}\x{200b}-\x{200f}\x{2028}\x{2029}\x{feff}]'` efter hver redigering med escapes.

### F-071 · 2026-10-13 · "Encountered a script tag while rendering React component" på 404-sider
- **Område:** UI / Next.js (sangbogens præferencescript)
- **Symptom:** I dev viste browserkonsollen (og E2E-loggen, 31 gange) advarslen på hver ægte 404 efter, at rodlayoutet fik sit inline-script (D-124).
- **Årsag:** En medlems-404 renderer dokumentet på klienten (som F-043), og React advarer, når det selv opretter et `<script>`, der ikke er en datablok.
- **Rettelse:** `SongbookPrefsScript` (klientkomponent) renderer scriptet uden `type` på serveren og med `type="text/plain"` på klienten (`suppressHydrationWarning`). Hydreringen beholder serverens script, og en klient-render laver et inaktivt element uden advarsel.
- **Læring / forebyggelse:** Inline-scripts i rodlayoutet skal tåle en klient-render. Tjek også 404-sider for konsolfejl.

### F-070 · 2026-10-09 · "Failed to execute 'measure' on 'Performance'" i dev
- **Område:** Tooling
- **Symptom:** Browserkonsollen (og E2E-loggen via Next' videresendelse af browserlogs) viser "Uncaught TypeError: Failed to execute 'measure' on 'Performance': '​ClubLayout' cannot have a negative time stamp." på sider, der ender i `notFound()`, fx en redigeringsside uden ret eller klubben efter "Forlad klubben".
- **Årsag:** Reacts performance tracks i development. Ikke appens kode.
- **Rettelse:** Ingen. Siderne og testene virker, og det sker ikke under `next start`.
- **Læring / forebyggelse:** Jag den ikke, medmindre den dukker op i produktion.

### F-069 · 2026-10-09 · Playwrights `name` matcher delstrenge
- **Område:** Tests
- **Symptom:** Strict mode-fejl mellem regionerne "Oktober 2026" og "Tidligere ølsmagninger Oktober 2026".
- **Årsag:** `getByRole(…, { name })` matcher delstrenge uden hensyn til store/små bogstaver.
- **Rettelse:** `exact: true` på regionsnavne (D-114).
- **Læring / forebyggelse:** Brug `exact: true`, når tilgængelige navne kan indeholde hinanden.

### F-068 · 2026-10-09 · React Compiler-lint afviste ref-aliaser og setState i effekter
- **Område:** UI / Tooling
- **Symptom:** `react-hooks/refs` og `react-hooks/set-state-in-effect` fejlede, da `formProps.ref` blev lagt i en lokal variabel og brugt i deps (og så også markerede `<form {...formProps}>`), og ved setState direkte i en effekt.
- **Rettelse:** Refs læses kun i `useEffectEvent` eller handlers. DOM-tilstand overføres til React-state fra en callback (`requestAnimationFrame`) inde i effekten (`use-place-and-hosts.ts`).
- **Læring / forebyggelse:** Samme mønster for nye hooks, der skal læse formularens DOM.

### F-067 · 2026-10-09 · `!important` mod streamede segmenter virker ikke under Tailwind v4
- **Område:** Tests
- **Symptom:** `div[hidden]{display:block!important}` viste ikke de streamede segmenter i et no-JS-tjek (F-054).
- **Årsag:** Preflights `[hidden]{display:none!important}` ligger i `@layer base`, og en lagdelt `!important` vinder over en ulagdelt.
- **Rettelse:** Omskriv dokumentet og fjern `hidden`-attributten fra `<div hidden id="S:…">`.

### F-066 · 2026-10-09 · Next scroller ikke til et `#hash`-mål bag `loading.tsx`
- **Område:** Kalender
- **Symptom:** "Se alle tidligere" landede øverst på Kalender i stedet for ved `#tidligere`.
- **Årsag:** Sektionen streames ind, efter Next' scroll-håndtering har kørt.
- **Rettelse:** Klientkomponenten `ScrollToHash`, keyed på indholdet (D-114).

### F-065 · 2026-10-09 · Playwrights `check()` ramte ikke en 1 px sr-only-radio
- **Område:** UI / Tests
- **Symptom:** `check()` på stedvælgerens radio timede ud ("<div> intercepts pointer events").
- **Årsag:** En sr-only-input ligger i wrapperens hjørne uden for sin label, og Playwright accepterer ikke labelen som mål.
- **Rettelse:** En usynlig radio i fuld størrelse øverst på kortet (D-111). Tryk på mobil rammer nu også selve radioen.

### F-064 · 2026-10-09 · Screenshot før hydrering gav et "1 Issue"-mærke i dev
- **Område:** Tests
- **Symptom:** Next' dev-overlay viste en hydreringsfejl på formularsider i screenshots.
- **Årsag:** Playwrights screenshot (`caret: hide`) satte `caret-color: transparent` inline på inputs, før React havde hydreret.
- **Rettelse:** Vent på hydrering (`expectHydrated` eller `__reactProps$`) før screenshots af formularer.

### F-063 · 2026-10-09 · En grid med `justify-items-start` gav vandret scroll ved lange ord
- **Område:** UI
- **Symptom:** En adresse på 200 tegn gjorde stedets side 1489 px bred ved 375 px. Fundet af den nye E2E-test med lange navne.
- **Årsag:** `justify-items-start` giver grid-elementer max-content-bredde, så `break-words` aldrig bryder.
- **Rettelse:** `justify-self-start` kun på knappen (`place-about.tsx`). Eventsidens fod (værter, "Oprettet af") brugte `justify-items-center` på samme måde og har nu `grid-cols-1`.
- **Læring / forebyggelse:** Brug aldrig `justify-items-start/center` på en grid med brugertekst (samme klasse som F-028/F-047).

### F-062 · 2026-10-09 · Forældet `.next-e2e/dev` gav en genindlæsningsløkke under E2E
- **Område:** Tests
- **Symptom:** Signup blev stående på `/signup` og navigerede igen og igen, eller CSS'en manglede (begge navigationer synlige), og browseren meldte `ERR_NETWORK_IO_SUSPENDED`.
- **Årsag:** Rutetræet var ændret af andre agenter siden sidste E2E-kørsel (som F-013).
- **Rettelse:** Først `rm -rf .next-e2e/dev` inden for samme `flock` som kørslen. Integratorens anden fulde kørsel fejlede igen i 15 desktop-tests ved første bølge af signups på en varm cache, uden kodeændringer. Nu sletter Playwrights `webServer.command` selv `.next-e2e/dev`, hver gang den starter en ny E2E-server (`playwright.config.ts`); en kørende server genbruges stadig.
- **Læring / forebyggelse:** En ny start af `next dev` på en gammel Turbopack-cache er ikke til at stole på. Ryd cachen ved start, ikke først når det går galt.

### F-061 · 2026-10-09 · Forkert nuværende password blev annonceret to gange
- **Område:** Profil
- **Symptom:** Beskeden stod både som alert og som feltfejl (E2E: strict mode-fejl).
- **Årsag:** `useActionForm` viste enhver ikke-VALIDATION-fejl som `formError`, også en med fieldErrors. `toAuthActionError(…, "change-password")` giver INVALID_PASSWORD med `fieldErrors.currentPassword`.
- **Rettelse:** Først en lokal omvej i `ChangePasswordForm`. Integratoren flyttede reglen ind i `useActionForm` (`formError` er null, når fejlen har fieldErrors, D-109) og fjernede omvejene i `ChangePasswordForm` og `PlaceForm`.

### F-060 · 2026-10-09 · Fokus vendte ikke tilbage til '⋯' efter en styret dialog
- **Område:** UI / Tilgængelighed
- **Symptom:** Efter annuller, Escape eller succes lå fokus på `<body>`, og tastaturbrugeren mistede sin plads på medlemslisten.
- **Årsag:** Radix Dialog/AlertDialog returnerer kun fokus til sin egen Trigger, og en styret `ConfirmDialog` uden trigger har ingen.
- **Rettelse:** `MemberActionsMenu` åbner dialogen fra menuens `onCloseAutoFocus` og fokuserer '⋯' i en effekt, når dialogen lukker. Se TG-041.
- **Læring / forebyggelse:** Alle menu → dialog-flows skal selv returnere fokus.

### F-059 · 2026-10-09 · `Intl.Collator('da')` sorterer store bogstaver før små
- **Område:** Tests
- **Symptom:** `compareByDisplayName`/`comparePlacesByName` satte "Anders" før "anders", modsat testens forventning.
- **Årsag:** CLDR da har `caseFirst: "upper"`.
- **Rettelse:** Testforventningerne er rettet.

### F-058 · 2026-10-09 · ESLints flat config læser ikke `.gitignore`
- **Område:** Tooling
- **Symptom:** `npm run check` fejlede på den git-ignorerede `.work/songbook/*.cjs`.
- **Rettelse:** `.work/**` i `globalIgnores` i `eslint.config.mjs`.
- **Læring / forebyggelse:** Nye git-ignorerede mapper med kode skal også ignoreres i ESLint (Prettier 3 læser `.gitignore` selv).

### F-057 · 2026-10-09 · Agentens værktøj afkodede `\uXXXX` til bogstavelige tegn
- **Område:** Tooling
- **Symptom:** Testfiler fik usynlige NBSP-, BOM- og kombinationstegn, og migreringens whitespace-klasse består af bogstavelige tegn.
- **Rettelse:** TS-filerne blev konverteret tilbage til escapes af et script, der byggede dem fra kodepunkter. Migreringen er ladt urørt: samme semantik, og `round3-migration.itest.ts` læser klassen fra SQL'en og beviser paritet med JS `\s` over hele BMP.
- **Læring / forebyggelse:** Generér usynlige tegn fra kodepunkter i et script. Redigér aldrig en anvendt migrering (checksum).

### F-056 · 2026-10-09 · Zod 4: `.max` på elementer plus `.refine` på listen gav dobbelte fejl
- **Område:** Validering
- **Symptom:** For lange `hostIds` gav "Vælg værter fra listen." to gange, den ene på stien `hostIds.0`, som formularen ikke har et felt til.
- **Rettelse:** `idListSchema` har én `superRefine` på listen (for mange → `tooMany`, ellers ugyldig → `invalid`).
- **Læring / forebyggelse:** Listefelter får ét tjek på selve listen.

### F-055 · 2026-10-09 · `updateEvent` kunne skrive et fjernet medlems værtskab tilbage
- **Område:** DB / Samtidighed
- **Symptom:** Fundet ved analyse og bevist med en forskudt race-test: blev de eksisterende værter læst før `lockMemberIds`, talte et medlem, der blev fjernet imens, som "eksisterende tidligere vært" og blev sat ind igen på et kommende event.
- **Rettelse:** `updateEvent` læser de eksisterende værter efter, at medlemskaberne er låst FOR SHARE (D-098).
- **Læring / forebyggelse:** I et tjek af typen "medlemmer ∪ eksisterende" læses "eksisterende" efter låsen, der serialiserer mod fjernelse.

### F-054 · 2026-10-09 · No-JS-tjek i dev ser ikke sider med `loading.tsx`
- **Område:** Tests
- **Symptom:** Med `javaScriptEnabled: false` var formularerne på `/events/new`, `/beers/new` og `/onboarding` "not visible".
- **Årsag:** `next dev` streamer `loading.tsx`-grænser. Indholdet ligger i `<div hidden id="S:…">` og skiftes ind af et inline-script, der ikke kører uden JS (TG-019).
- **Rettelse:** I et manuelt no-JS-tjek omskrives dokumentsvarene (`context.route`, kun læsning), så `hidden` fjernes (F-067).
- **Læring / forebyggelse:** Overvej det, før en sides no-JS-sti loves. Omvendt: en side indlæst uden JS viser netop skeletonet, så det er sådan, man ser `loading.tsx` i dev (en klientnavigation med et tilbageholdt RSC-svar beholder den gamle side).

### F-053 · 2026-10-09 · Et kontrolleret `<select>` mistede valget efter serverens svar
- **Område:** Ølkatalog / UI
- **Symptom:** I "Tilføj øl" med et valgt event og et dublet-svar fra serveren (DUPLICATE_BEER, fx en øl tilføjet samtidig) viste feltet "Intet event", og "Tilføj alligevel" gemte øllen uden event. Fejlen fandtes også før TG-021.
- **Årsag:** React 19 nulstiller formularen (`form.reset()`), når en `<form action>` har svaret. Et kontrolleret `<select>` falder tilbage til sin første option, og kontrollerede checkbokse og radioer til deres oprindelige `defaultChecked`, mens React-staten beholder valget.
- **Rettelse:** `useBeerForm` sætter selectens værdi tilbage i en layout-effekt, når action-staten ændres (aldrig ved mount). Stedvælger og værtsvalg gør det samme med `useCheckedAfterReset` (D-113). Ny E2E: "en dublet, som kun serveren kender, beholder det valgte event" (`beers.spec.ts`), der fejler uden rettelsen.
- **Læring / forebyggelse:** Kontrollerede select-, checkbox- og radiofelter i en Server Action-formular skal synkroniseres igen efter hvert svar, eller være ukontrollerede med `defaultValue`/`defaultChecked` fra ekkoet.

### F-052 · 2026-10-09 · Screenshot fangede en CSS-transition midtvejs
- **Område:** Tests
- **Symptom:** Den valgte dag i kalenderen lignede en kontrastfejl på et screenshot.
- **Årsag:** Et tryk på en dag kalder kun `history.replaceState`. `waitForLoadState('networkidle')` returnerer derfor straks, og screenshottet fangede en 150 ms `transition-colors`.
- **Læring / forebyggelse:** Vent på tilstanden (fx `aria-label` slutter på "valgt") og ~200 ms før screenshot.

### F-051 · 2026-10-09 · Dev-serveren serverede en forældet `globals.css`
- **Område:** Tooling
- **Symptom:** Efter en ændring i `globals.css` fortsatte :3000 med den gamle CSS, også efter en almindelig genstart. `.tsx`-ændringer hot-reloadede fint.
- **Rettelse:** Stop via PID, `rm -rf .next/dev`, start igen (som F-013/F-040).
- **Læring / forebyggelse:** Efter en ændring i `globals.css`: grep i den serverede CSS-chunk efter den nye regel før runtime-tjek.

### F-050 · 2026-10-09 · Toasts dækkede top-baren ved 601–767 px
- **Område:** UI (runde 1-shell, synliggjort af D-075)
- **Årsag:** Sonners `mobileOffset` gælder kun ≤ 600 px, men top-baren vises op til 767 px.
- **Rettelse:** En ulagdelt regel i `globals.css`: `@media (width < 48rem) { html [data-sonner-toaster][data-y-position="top"] { top: var(--mobile-offset-top) } }`.

### F-049 · 2026-10-09 · Kalenderens skeleton ignorerede `?view`
- **Område:** UI
- **Symptom:** Layoutet hoppede under indlæsning (liste ↔ måned), fx via "Se hele kalenderen".
- **Rettelse:** `calendar-loading-skeleton.tsx` læser `?view` med `useSearchParams` (D-087).

### F-048 · 2026-10-09 · `?month=2999-12` gav et tomt månedsgitter
- **Område:** Kalender
- **Årsag:** Gitteret parsede næste måneds nøgle igen. 3000-01 er uden for intervallet og faldt tilbage til 1970, så gitteret blev tomt, og forespørgselsintervallet var vendt om.
- **Rettelse:** Dagnumre beregnes fra månedens egne dele med `Date.UTC`-rollover. Intervalslut efter `MAX_EVENT_YEAR` bruger grænsen `AFTER_LAST_EVENT`. Unit tests for 1900-01 og 2999-12.

### F-047 · 2026-10-09 · Lange ord og URL'er flød ud over eventsiden
- **Område:** UI
- **Symptom:** Ved 375 px flød eventsiden 181 px ud med en lang URL i planen.
- **Årsag:** `EventSection` (`grid gap-5` uden `grid-cols-1`) brød F-028's regel. PageHeader-beskrivelsen manglede `break-words`.
- **Rettelse:** `grid-cols-1` på enkeltkolonne-grids med brugertekst + `break-words hyphens-auto`. Ny E2E i `long-names.spec.ts`.
- **Læring / forebyggelse:** Samme klasse som F-028. Al brugertekst skal kunne brydes.

### F-046 · 2026-10-09 · NUL-tegn i fritekst gav den generiske fejl
- **Område:** Validering
- **Årsag:** Postgres `text` kan ikke indeholde U+0000. Valideringen slap det igennem, og skrivningen fejlede.
- **Rettelse:** `stripNul` (`src/lib/text.ts`) i schemaerne for event, øl, klubnavn og brugernavn (D-090).

### F-045 · 2026-10-09 · Klient og server brugte forskellige dublet-regler
- **Område:** Ølkatalog
- **Symptom:** Dublet-advarslen (E21) kunne vises i formularen uden at serveren gjorde det, og omvendt ("Grimbergen Dubbel" mod "GrimbergenDubbel").
- **Rettelse:** Én fælles `beerDuplicateKey`/`findSameNameBeers` (D-086). Dækket af integrationstests.

### F-044 · 2026-10-09 · ABV-parseren kunne låse serveren (ReDoS)
- **Område:** Ølkatalog / Sikkerhed
- **Symptom:** Regexes på alkoholprocent tog ca. 3,9 s og 2,8 s på 100 kB input. Feltet parses før sessionstjekket (§4.3), så en ~1 MB POST uden login kunne binde event-loopet i minutter.
- **Årsag:** `/\s*%$/` og `/0+$/` har kvadratisk backtracking på ubegrænset input.
- **Rettelse:** `ABV_INPUT_MAX_LENGTH = 16` før al parsing, `endsWith`/`slice` i stedet for regexes, `maxLength` på input. 1 MB afvises nu på under 1 ms.
- **Læring / forebyggelse:** Felter, der parses før auth, skal have et længdeloft før parsing. Ingen kun-slut-forankrede regexes på utroværdigt input (D-090).

### F-043 · 2026-10-08 · Klubbens 404 i produktion har tom HTML-body
- **Område:** Routing
- **Symptom:** Under `next start` returnerer et medlems klub-404 HTTP 404, men HTML'en er tom. AppShell og 404-teksten renderes på klienten fra RSC-payloaden.
- **Årsag:** Next' adfærd, når `notFound()` kastes før streaming (guard-layout / catch-all).
- **Rettelse:** Ikke rettet (framework-adfærd). Korrekt med JS. Se TG-018.

### F-042 · 2026-10-08 · Prettier omorganiserer klasser, så scriptede erstatninger fejler stille
- **Område:** Tooling
- **Symptom:** En scriptet strengerstatning i `rating-summary.tsx` matchede ikke, fordi Prettier havde ombyttet Tailwind-klasserne.
- **Læring / forebyggelse:** Grep efter resultatet efter scriptede redigeringer i formaterede filer.

### F-041 · 2026-10-08 · F-019 holder ikke længere i Next 16.4 dev
- **Område:** Tests
- **Symptom:** Next 16.4 dev streamer også til HeadlessChrome. Med JS helt slået fra bliver sider under en `loading.tsx` stående på skeletonet.
- **Læring / forebyggelse:** Test progressive enhancement ved at blokere `/_next/static/*.js` (inline-scripts kører stadig) i stedet for at slå JS fra. Se D-085.

### F-040 · 2026-10-08 · Dev-serveren genindlæste i en løkke efter `npm run build`
- **Område:** Tooling
- **Rettelse:** Stop :3000 via PID, `rm -rf .next/dev`, start igen. README: ryd `.next/dev` efter hvert build. (F-013 igen.)

### F-039 · 2026-10-08 · E2E-klik før hydrering gjorde ingenting
- **Område:** Tests
- **Symptom:** Klik på JS-kontroller (ConfirmDialog, katalogets selects, stjerner) lige efter `goto`/`reload` blev ignoreret, og testen timede ud.
- **Rettelse:** `expectHydrated(locator)` (`e2e/support/app.ts`) venter på Reacts `__reactProps$` på elementet. Links og formularer kræver ingen ventetid.

### F-038 · 2026-10-08 · Forfalskede skjulte felter i tests ændrede seed-rækker
- **Område:** Tests
- **Symptom:** Et "manipulér id"-tjek satte et React-kontrolleret skjult felt via DOM'en. React gendannede værdien ved næste render, så formularen gemte en ægte seed-række ("Hacket af Mads", "HACKED Westmalle"). Rækkerne er gendannet via SQL.
- **Læring / forebyggelse:** Manipulér aldrig React-kontrollerede felter via DOM'en. Omskriv requesten (Playwright `page.route`), og ram kun data, der må smides væk.

### F-037 · 2026-10-08 · Zod 4: `abort` på et felt springer objektniveau-refinements over
- **Område:** Validering
- **Symptom:** "Sluttiden skal være en anden end starttiden." blev ikke vist, så længe datoen var tom eller ugyldig.
- **Årsag:** `.min(1, { abort: true })` på `date` afbryder payloaden, og Zod 4 springer så objektniveau-`.refine` over, også med `when`.
- **Rettelse:** Én `superRefine` på datoen uden `abort`. Testet i `round2-validation.test.ts`.

### F-036 · 2026-10-08 · Zod 4 fortsætter efter en fejlet `.min(1)`
- **Område:** Validering
- **Symptom:** En tom dato gav både "Vælg en dato." og "Datoen findes ikke …".
- **Læring / forebyggelse:** Se F-037 for den endelige løsning (superRefine uden abort, når objektniveau-tjek skal køre).

### F-035 · 2026-10-08 · Prisma 7's `migrate dev` kører ikke `generate`
- **Område:** DB
- **Symptom:** Efter migrationen manglede de nye modeller i `src/generated/prisma`.
- **Rettelse:** Kør `npx prisma generate` efter `migrate dev`, og genstart :3000 (klienten er cachet på `globalThis`).

### F-034 · 2026-10-08 · `TZDate`-konstruktøren afhænger af maskinens tidszone ved sommertidsskift
- **Område:** Datoer
- **Symptom:** `new TZDate(2026, 9, 25, 2, 30, 'Europe/Copenhagen')` gav 00:30Z på en dansk maskine, men 01:30Z under `TZ=America/Los_Angeles`.
- **Rettelse:** `src/server/domain/events/time.ts` regner vægur ↔ UTC alene med `tzOffset` (D-069). Testene kører under 5 systemtidszoner.
- **Læring / forebyggelse:** Brug aldrig `TZDate`-konstruktøren til vægur-input. Kør tidstests med flere `TZ`-værdier.

### F-033 · 2026-10-08 · Nye lokale databaser blev SQL_ASCII
- **Område:** DB / Tooling
- **Symptom:** `olklubben_itest` blev oprettet som SQL_ASCII/C.
- **Årsag:** En almindelig `CREATE DATABASE` kopierer `template1`, som er SQL_ASCII på denne server.
- **Rettelse:** Global setup bruger `TEMPLATE template0 ENCODING 'UTF8'`. README gør det samme.
- **Læring / forebyggelse:** Opret altid projektdatabaser med `-T template0 -E UTF8`. Ellers opfører længde-CHECKs og æ/ø/å sig anderledes.

### F-032 · 2026-10-08 · `@next/env` kan ikke importeres med navn i en Vitest `.mts`-config
- **Område:** Tests
- **Symptom:** `SyntaxError: Named export 'loadEnvConfig' not found`.
- **Årsag:** `@next/env` er ncc-bundlet CommonJS uden genkendelige named exports.
- **Rettelse:** `createRequire(import.meta.url)('@next/env')` i `tests/integration/env.mts`.

### F-031 · 2026-10-08 · Previews kunne have migreret produktion
- **Område:** Deploy
- **Symptom:** README sagde, at `DIRECT_URL` skulle sættes i Vercel, og `prisma.config.ts` migrerede `DIRECT_URL || DATABASE_URL`.
- **Årsag:** En Vercel-variabel er ens for alle previews, så hvert preview-build ville køre `migrate deploy` mod den samme database (typisk produktion).
- **Rettelse:** `resolveMigrationUrl`/`assertMigrationUrlSafe` (`src/lib/migration-url.ts`), guard i `prisma.config.ts`. README og `.env.example` opdateret (D-058).
- **Læring / forebyggelse:** Sæt aldrig per-deployment database-URL'er manuelt i Vercel. Brug integrationens variabler pr. branch.

### F-030 · 2026-10-08 · ProfileNameForm slugte redirects fra Server Actionen
- **Område:** UI / Auth
- **Symptom:** Med en forældet session gik "Gem navn" til `/login`, men viste også den røde generiske toast.
- **Årsag:** En bar `catch {}` om `await updateProfileName()`. Next afviser action-promiset med en `NEXT_REDIRECT`-fejl.
- **Rettelse:** `unstable_rethrow(err)` først i catch-blokken.
- **Læring / forebyggelse:** Alle klient-try/catch om en Server Action skal kalde `unstable_rethrow` først. I tests består `expect(loc).toHaveCount(0)` også, når et forbigående element (en toast) forsvinder. Bevis fravær med en kort ventetid og én optælling.

### F-029 · 2026-10-08 · Fokusringen blev klippet på Profils rækker
- **Område:** UI / a11y
- **Årsag:** Listens `overflow-hidden` klippede den globale outline.
- **Rettelse:** `focus-visible:-outline-offset-3` på række-linket + afrundede hjørner på `li`.
- **Læring / forebyggelse:** Rækker i en `overflow-hidden`-container skal have negativ outline-offset.

### F-028 · 2026-10-08 · Lange klubnavne flød ud over kanten
- **Område:** UI
- **Symptom:** Ved 375 px kunne `/clubs` scrolles 381 px sidelæns, og PageHeader-h1 591 px. Klubskifterens menu afkortede navne til ~138 px.
- **Årsag:** `grid gap-3` uden `grid-cols-*` giver et `auto`-spor, hvis minimum er en `truncate`-tekst. h1 ombrød ikke lange ord.
- **Rettelse:** `grid-cols-1` + `line-clamp-3 break-words hyphens-auto`, h1 `break-words hyphens-auto`, bredere menu (D-060). Dækket af `e2e/long-names.spec.ts`.
- **Læring / forebyggelse:** Brug `grid-cols-1` til lister med brugertekst.

### F-027 · 2026-10-08 · `notFound()` under `loading.tsx` giver en blød 404
- **Område:** Routing
- **Symptom:** Et medlem får 404-UI'et med HTTP 200 på ukendte klub-undersider.
- **Årsag:** Svaret streames allerede, når `notFound()` kører under `c/[clubId]/loading.tsx` (dokumenteret af Next).
- **Rettelse:** Accepteret for nu (D-053, TG-008). Ikke-medlemmer og ugyldige id'er får stadig en ægte 404.

### F-026 · 2026-10-08 · Link-prefetch skiftede aktiv klub
- **Område:** Routing
- **Symptom:** At hover/vise et link til en anden klub kunne ændre `lastActiveClubId`.
- **Årsag:** Automatisk prefetch renderer layouts ned til nærmeste `loading.tsx`, og klublayoutet kaldte `rememberActiveClub`.
- **Rettelse:** `requireClubPage` på siderne. Layoutet skriver ikke længere (D-052).
- **Læring / forebyggelse:** Ingen databaseskrivninger i layouts. Next 16.4 skjuler Flight-/prefetch-headere for `headers()` og proxyen.

### F-025 · 2026-10-08 · Forældet session-cookie mistede det dybe link
- **Område:** Auth / Routing
- **Symptom:** Med en cookie, hvis session var væk, slap proxyen requesten igennem, og `requireUser` redirectede til `/login` uden `?next=`.
- **Rettelse:** Proxyen videresender stien i request-headeren `x-olk-return-to` (og fjerner indkommende kopier). `requireUser` bruger den via `safeRedirectPath`.

### F-024 · 2026-10-08 · Sessions blev kun forlænget i databasen, ikke i cookien
- **Område:** Auth
- **Symptom:** `sessions.expires_at` blev forlænget dagligt, men cookiens Max-Age blev stående fra login. Browseren ville smide cookien 60 dage efter login trods daglig brug.
- **Årsag:** `getSession` i Server Components forlænger rækken, men cookie-skrivningen sluges i RSC.
- **Rettelse:** D-049. Dækket af `e2e/session.spec.ts`.

### F-023 · 2026-10-08 · Profilbilledet kunne sættes til en vilkårlig URL
- **Område:** Auth / Sikkerhed
- **Symptom:** `/api/auth/update-user` og `/sign-up/email` accepterede ethvert `image`, fx en tracking-pixel. En ikke-streng gav 500.
- **Rettelse:** `isAllowedUserImage()` (D-048) i create/update-hooks og `pictureFromIdToken`.

### F-022 · 2026-10-08 · Ældre nulstillingstokens forblev gyldige til udløb
- **Område:** Auth
- **Symptom:** Et nyt admin-link eller en ventende "Glemt password"-mail efterlod tidligere links gyldige i op til 1 time. Efter en nulstilling kunne et søskende-token ændre passwordet igen.
- **Årsag:** Better Auth bruger kun det anvendte token op.
- **Rettelse:** `onPasswordReset` sletter alle verification-rækker med `value = userId`. `createPasswordResetUrl` gør det samme før et nyt link (D-047).

### F-021 · 2026-10-08 · `useActionState` og generisk state-type
- **Område:** UI
- **Symptom:** TS2769 i en generisk form-hook.
- **Årsag:** React typer staten som `Awaited<S>`.
- **Rettelse:** Action typet som `(state: Awaited<S>, formData) => Promise<S>` og initial state `null as Awaited<S>`.
- **Læring / forebyggelse:** Genbrug `src/components/features/auth/use-auth-form.ts` som mønster.

### F-020 · 2026-10-08 · Parallelle agenter løb ind i rate limits på den fælles dev-server
- **Område:** Tooling
- **Symptom:** 429 "Rolig nu" ved login som `jesper@example.com` og ved signup fra 127.0.0.1.
- **Årsag:** Alle agenter deler én IP og de samme seed-brugere. Grænserne (D-028) virker efter hensigten.
- **Rettelse:** Genbrug sessions (Playwright `storageState`), og log ikke ind for hver browser-context. E2E kører med `RATE_LIMIT_DISABLED`.
- **Læring / forebyggelse:** Overvej `RATE_LIMIT_DISABLED=1` i `.env.local`, når flere agenter tester samtidig (det virker aldrig i produktion).

### F-019 · 2026-10-08 · Next streamer ikke til headless Chromium
- **Område:** Tests
- **Symptom:** `loading.tsx`-skeletons blev aldrig vist i headless-kørsler.
- **Årsag:** Next ser headless Chromiums standard-user-agent som en bot og streamer ikke.
- **Rettelse:** Sæt en almindelig Chrome-user-agent, når skeletons skal testes eller fotograferes.

### F-018 · 2026-10-08 · `Intl` da-DK giver "18.30" og varierende ugedage
- **Område:** UI / Datoer
- **Symptom:** Tidspunkter som "18.30" (SPEC vil have "18:30"), og nogle ICU-versioner skriver "torsdag den 8. oktober".
- **Rettelse:** `src/lib/format/date.ts` bygger strengene af `formatToParts` (D-039). Unit tests låser output.
- **Læring / forebyggelse:** Brug altid `src/lib/format/date.ts` til datoer og tider.

### F-017 · 2026-10-08 · `/join/%25` kunne give 500
- **Område:** Klubber
- **Symptom:** `decodeURIComponent('%')` kaster `URIError`.
- **Rettelse:** `safeDecode()` på join-siden. Det giver nu E18.
- **Læring / forebyggelse:** Dekod aldrig route-parametre uden try/catch.

### F-016 · 2026-10-08 · tailwind-merge fjerner `leading-*` før `text-*`
- **Område:** UI
- **Symptom:** `cn('leading-tight', 'text-lg')` fjerner `leading-tight`, fordi `text-*` i Tailwind v4 også sætter line-height.
- **Rettelse:** Placér `leading-*` efter størrelsesklassen (gjort i ClubSwitcher).
- **Læring / forebyggelse:** Andre komponenter, der kombinerer de to i `cn()`, kan have samme stille fejl. Også rettet i `Logo` og `ClubBadge` (`leading-none` efter størrelsen, før `className`).

### F-015 · 2026-10-08 · Next' route announcer har `role="alert"`
- **Område:** Tests
- **Symptom:** `page.getByRole('alert')` matcher to elementer.
- **Rettelse:** Assert på fejlteksten, eller scope til dialog/formular.

### F-014 · 2026-10-08 · ESLint rules-of-hooks fanger Playwright-fixtures
- **Område:** Tests
- **Symptom:** `React Hook "use" is called in function "openPage"` i `e2e/fixtures.ts`.
- **Rettelse:** Callback-parameteren hedder `provide` i stedet for `use`.

### F-013 · 2026-10-08 · Dev-serveren genindlæste i en uendelig løkke
- **Område:** Tooling
- **Symptom:** `{type:'reloadPage', data:'HMR hash mismatch'}` på hver sideindlæsning efter `npm uninstall` + `npm run build`.
- **Årsag:** Forældet Turbopack-cache i `.next/dev`.
- **Rettelse:** Stop dev-serveren, `rm -rf .next/dev`, start igen.
- **Læring / forebyggelse:** Efter ændrede afhængigheder eller et build: ryd `.next/dev`, hvis dev-serveren genindlæser i en løkke. Det sker også for E2E-cachen (`.next-e2e/dev`) efter midlertidige kildeændringer (fx når en route-mappe slettes og gendannes ved revert-tjek). Symptom: alle tests fejler med `ERR_ABORTED`, eller signup hænger på `/signup` med gentagne "navigated to /signup". Ret: stop E2E-serveren og kør `rm -rf .next-e2e/dev`.

### F-012 · 2026-10-08 · Tidsstempler gemt forskudt i lokale databaser
- **Område:** DB
- **Symptom:** Tidsstempler skrevet via Prisma lå 1–2 timer forkert i forhold til `now()` (fx `15:44+02` kl. 17:44 CEST).
- **Årsag:** `@prisma/adapter-pg` 7.10 sender `Date`-parametre som UTC-vægur uden offset og antager en UTC-session, men den lokale Postgres kører `TimeZone=Europe/Copenhagen`. Neon kører UTC.
- **Rettelse:** `-c TimeZone=UTC` på forbindelsesniveau via `pgConfig()` i `src/server/db/pg-config.ts` (D-045). Ingen `ALTER DATABASE`. Verificeret: en ny sessions `created_at` ligger 0,02 s fra `now()`. Rækker skrevet før rettelsen forbliver forskudt, indtil Jesper kører `npm run db:reset` (TG-013).
- **Læring / forebyggelse:** Alle databaseforbindelser skal køre i UTC. Kritisk for events og afstemninger (E20).

### F-011 · 2026-10-08 · `npx playwright install` ryddede gamle browsere
- **Område:** Tooling
- **Symptom:** Ældre browser-builds (chromium-1194, firefox-1495, webkit-2215) forsvandt fra `~/.cache/ms-playwright`.
- **Årsag:** Playwright fjerner builds, som ingen installeret Playwright-version refererer til.
- **Rettelse:** Ingen nødvendig her. Andre projekter på maskinen med ældre Playwright skal evt. hente dem igen.
- **Læring / forebyggelse:** Vær opmærksom på sideeffekter uden for projektet.

### F-010 · 2026-10-08 · `pkill -f` dræbte agentens egen shell
- **Område:** Tooling
- **Symptom:** Oprydning efter en testserver kørte aldrig, og serveren fortsatte.
- **Årsag:** Mønsteret i `pkill -f` matchede også shellens egen kommandolinje.
- **Rettelse:** Find serverens PID med `ss -ltnp` og dræb den direkte.
- **Læring / forebyggelse:** Dræb servere via PID, aldrig med `pkill -f` i en sammensat kommando.

### F-009 · 2026-10-08 · Prisma 7 nægter `migrate reset` fra AI-agenter
- **Område:** DB / Tests
- **Symptom:** `prisma migrate reset` beder om `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`.
- **Årsag:** Prisma 7 opdager AI-agenter og kræver menneskeligt samtykke til destruktive kommandoer.
- **Rettelse:** E2E bruger `prisma migrate deploy` + TRUNCATE af alle tabeller i `*_test` (D-033). Samtykket er ikke omgået.
- **Læring / forebyggelse:** En agent må aldrig nulstille `olklubben_dev`. Det gør Jesper selv (`npm run db:reset`).

### F-008 · 2026-10-08 · `server-only` fejler i tsx-scripts
- **Område:** Tooling
- **Symptom:** Scripts, der importerer servermoduler, fejler på `server-only`.
- **Rettelse:** Kør med `npx tsx --conditions=react-server <script>` (og `NODE_PATH=$PWD/node_modules`, hvis scriptet ligger uden for projektet).
- **Læring / forebyggelse:** Brug `--conditions=react-server` til engangs-scripts mod serverkode.

### F-007 · 2026-10-08 · Better Auths nulstillingslink endte på `/api/auth/error`
- **Område:** Auth
- **Symptom:** `requestPasswordReset` uden `redirectTo` byggede et link, der endte på en fejlside.
- **Rettelse:** `sendResetPassword` bygger selv `${BETTER_AUTH_URL}/reset-password?token=…` (samme format som admin-linket, D-030).
- **Læring / forebyggelse:** Byg selv linket i auth-callbacks i stedet for at stole på Better Auths standard-URL.

### F-006 · 2026-10-08 · Google-linking blokeret af `requireLocalEmailVerified`
- **Område:** Auth
- **Symptom:** Better Auth 1.7 ville afvise at koble Google på eksisterende email/password-konti (§6.2, E19).
- **Årsag:** `accountLinking.requireLocalEmailVerified` er `true` som standard, og vores email/password-konti verificeres aldrig.
- **Rettelse:** Sat til `false` (D-029). Se TG-002 og TG-003.
- **Læring / forebyggelse:** Gennemgå Better Auths sikkerhedsstandarder ved hver opgradering.

### F-005 · 2026-10-08 · Better Auths rate limiting dækker ikke Server Actions
- **Område:** Auth / Sikkerhed
- **Symptom:** Antagelsen om, at `rateLimit.customRules` beskytter login/signup/reset, var forkert.
- **Årsag:** I 1.7.7 kører rate limiting kun i HTTP-routeren, ikke ved `auth.api.*`-kald fra Server Actions.
- **Rettelse:** `hooks.before`-middleware med egen database-limiter (`src/server/auth/auth-rate-limit.ts`, D-028). Verificeret for både `auth.api` og HTTP.
- **Læring / forebyggelse:** Verificér sikkerhedsmekanismer i bibliotekets kildekode, ikke kun i dokumentationen.

### F-004 · 2026-10-08 · Rå SQL-index ville blive droppet af Prisma
- **Område:** DB
- **Symptom:** Et partielt unikt index lagt ind som rå SQL i en migration bliver droppet ved næste `prisma migrate dev`.
- **Årsag:** Prisma differ indexes, som schemaet ikke kender. CHECK-constraints ignoreres derimod.
- **Rettelse:** Indexet er erklæret i schemaet via preview-featuren `partialIndexes` (D-027).
- **Læring / forebyggelse:** CHECK-constraints må gerne ligge i rå SQL, indexes må ikke.

### F-003 · 2026-10-08 · Egen `NEXT_DIST_DIR` omskriver `tsconfig.json`
- **Område:** Tooling
- **Symptom:** `next dev`/`next build` med en ny `NEXT_DIST_DIR` tilføjede globs til `tsconfig.json` og omformaterede den.
- **Rettelse:** `tsconfig.json` gendannet. `.next-e2e`-globs er forhåndslistet.
- **Læring / forebyggelse:** Brug aldrig en ny `NEXT_DIST_DIR` ad hoc. Kun `.next` og `.next-e2e`.

### F-002 · 2026-10-08 · Turbopack tracede hele projektet ind i serverbundlen
- **Område:** Deploy
- **Symptom:** Build-advarslen "Dynamic filesystem access causes tracing of the whole project". SPEC.md, e2e-filer og seed ville blive deployet i auth-funktionen.
- **Årsag:** `path.resolve(process.cwd(), …)` i `send-email.ts`.
- **Rettelse:** `/* turbopackIgnore: true */` på `process.cwd()`-argumentet.
- **Læring / forebyggelse:** Al runtime-stibygning fra `process.cwd()` i serverkode skal have den kommentar. Tjek `.next/server/app/**/route.js.nft.json` for projektfiler.

### F-001 · 2026-10-08 · E2E-serveren blev aldrig "klar"
- **Område:** Tests
- **Symptom:** `Timed out waiting 120000ms from config.webServer`.
- **Årsag:** Playwrights readiness-probe følger redirects. `/` → 307 `/login` → 404 (siden fandtes ikke endnu).
- **Rettelse:** `webServer.url` peger på `/api/auth/ok`.
- **Læring / forebyggelse:** Brug aldrig en URL, der kræver login eller redirecter, som readiness-probe.

## 19.5 Kendte problemer og teknisk gæld

| ID | Dato | Beskrivelse | Konsekvens | Plan |
|---|---|---|---|---|
| TG-001 | 2026-10-04 | Email sendes via Gmail SMTP, fordi der ikke er et eget domæne | Afsender er en Gmail-adresse, og mails kan havne i spam | Når der kommer et domæne: skift til Resend, verificér SPF/DKIM, opdatér `EMAIL_FROM`, Google OAuth redirect-URI og `BETTER_AUTH_URL` |
| ~~TG-002~~ | 2026-10-08 | ~~Med `requireLocalEmailVerified = false` kan nogen oprette en konto med en andens email. Logger offeret senere ind med Google, kobles Google på den konto, og angriberen kender stadig passwordet.~~ | ~~Lav risiko i en privat klub-app, men reel~~ | ~~Verificér emails, eller fjern/kræv nulstilling af password, første gang Google kobles på en uverificeret konto~~ ✅ Løst 2026-10-26 af D-165: ingen automatisk kobling; Google forbindes fra Profil efter password-login. |
| ~~TG-003~~ | 2026-10-08 | ~~`requireLocalEmailVerified` er deprecated i Better Auth og fjernes i næste minor~~ | ~~Opgradering forbi 1.7.x stopper stille Google-linking for email/password-brugere~~ | ~~Behold `better-auth@1.7.7`, indtil linking er redesignet (fx sammen med TG-002)~~ ✅ Løst 2026-10-26 af D-165: `requireLocalEmailVerified` er fjernet (bruges kun af den automatiske kobling, som er slået fra). Låsen til 1.7.7 skyldes nu kun D-029s øvrige grunde. |
| TG-004 | 2026-10-08 | `partialIndexes` er en Prisma preview-feature, og den genererede `InviteWhereUniqueInput` indeholder `clubId` | `invite.findUnique({ where: { clubId } })` typechecker, men kan returnere en tilbagekaldt kode | Brug altid `findFirst({ where: { clubId, revokedAt: null } })`. Genbesøg, når featuren bliver stabil. |
| TG-005 | 2026-10-08 | `npm audit` melder high-severity-fund i dev-tooling (eslint-config-next, prisma CLI) | Kun dev-afhængigheder. Rettelserne kræver breaking downgrades. | Genbesøg ved næste opgradering af Next/Prisma. 2026-10-22 (D-155): genbesøgt ved Next 16.4.2. `next` meldes ikke længere. Tilbage: `eslint-config-next` 16.4.2 (via `fast-glob`; npm foreslår en downgrade til 14.2.35), `prisma` (`deepmerge-ts`, `mysql2`; rettet i 7.10.1, der ikke var en del af denne opgradering), `shadcn` (`fast-glob`, `braces`) og `ip-address` (moderate) |
| TG-006 | 2026-10-08 | `cacheComponents` er slået fra (D-025) | Next 17 forventes at gøre det obligatorisk | Planlæg migrering (Suspense-grænser om dynamiske dele) før opgradering til Next 17 |
| TG-007 | 2026-10-08 | Better Auth maskerer IPv6 til /64 i rate limit-nøgler | IPv6-klienter i samme /64 deler rate limit-spand | Acceptabelt. Grænserne er generøse. |
| ~~TG-008~~ | 2026-10-08 | ~~Medlemmer får en blød 404 (HTTP 200) på ukendte klub-undersider og ved `notFound()` på klubsider (D-053)~~ | Forkert statuskode. Gælder også runde 2's `/events/[eventId]`. | **Afgøres før runde 2**, fx ved at flytte `loading.tsx` ind i en route-gruppe ✅ Løst 2026-10-08 af D-065 (ægte 404, også under `next start`). |
| ~~TG-009~~ | 2026-10-08 | ~~Next' dev-indikator (top-right) dækker TopBarAction (+/Inviter) ved 375 px i development og E2E~~ | En mobil E2E-test, der klikker "+" i top-baren, vil blive opsnappet | Slå indikatoren fra for E2E-serveren ved starten af runde 2 ✅ Løst 2026-10-08 af D-067 for E2E. På :3000 dækker indikatoren stadig top-barens knap (kun i dev). |
| TG-010 | 2026-10-08 | Ingen pålidelig beskyttelse i appens kode mod sideeffekter af prefetch | Kun reglen "ingen skrivninger i layouts" og "aldrig `prefetch={true}` ind i en anden klub" beskytter | Overhold D-052 |
| TG-011 | 2026-10-08 | Google OAuth (callback, linking E19, billede) og rigtig SMTP er kun dækket af unit tests og kodegennemgang | Fejl i Google-flowet opdages først i produktion | Test manuelt, når `GOOGLE_*` og Gmail app password er sat op. **2026-10-26:** Google-flowet (callback, oprettelse, ingen automatisk kobling, eksplicit kobling, race med emailskift, state, lukkede endpoints) er dækket af `tests/integration/google-oauth.itest.ts` mod Better Auths rigtige handler med Googles token-endpoint mocket. Rigtig Google og SMTP mangler stadig en manuel test i produktion. **2026-10-28:** Auth0 tilsvarende dækket af `auth0-oauth.itest.ts` og `auth0-discovery.itest.ts`; rigtig Auth0-tenant mangler en manuel test |
| TG-012 | 2026-10-08 | Ikke verificeret på en rigtig Vercel + Neon-deploy (preview-branching, migration-guard, `BETTER_AUTH_URL` på previews) | Første deploy kan kræve justeringer | Følg README's "Deploy til Vercel + Neon"-tjekliste ved første deploy |
| TG-013 | 2026-10-08 | Rækker i lokale `olklubben_dev` skrevet før D-045 har forskudte tidsstempler | Kun kosmetisk i dev | Jesper kører `npm run db:reset` (agenter må ikke, F-009) |
| TG-014 | 2026-10-08 | Ingen CI. Vercel-buildet type-checker, men kører ikke lint/tests. Produktionsstier (prefetch, tvungne rate limits, ingen dev-outbox, "Kontakt en admin") tjekkes kun manuelt. | Regressioner kan nå produktion | Når repoet har et remote: GitHub Actions med `npm run check`, `test:integration` og `test:e2e` mod en Postgres-service |
| TG-015 | 2026-10-08 | Når SMTP er sat op, bør et medlem få en email, når en admin laver et nulstillingslink til dem | Medlemmet opdager ikke et misbrugt link | Implementér sammen med SMTP-opsætning |
| TG-016 | 2026-10-08 | Berettigelse til admin-link (D-046) tjekkes, når linket laves. Joiner medlemmet en anden klub inden for 1 time, er linket stadig gyldigt. | Lille restvindue | Accepteret |
| TG-017 | 2026-10-08 | Én fast ventetid (`waitForTimeout(1_000)`) i E2E-testen for forældet session | Kan i teorien være skrøbelig | Acceptabelt. Fravær af en forbigående toast kan ikke assertes med en retrying matcher. |
| TG-018 | 2026-10-08 | Et medlems klub-404 i produktion har tom HTML-body og renderes på klienten (F-043) | Tom side uden JS | Genbesøg ved Next-opgraderinger |
| TG-019 | 2026-10-08 | Uden JS bliver klubsider under en `loading.tsx` stående på skeletonet (D-085) | Kun hvis JS er helt slået fra | Accepteret |
| TG-020 | 2026-10-08 | JS-kontroller (ConfirmDialog, stjerner) ignorerer input før hydrering. Katalogets selects nulstilles ved hydrering. | Kun mærkbart ved langsom første indlæsning | Overvej at deaktivere kontrollerne visuelt, indtil de er hydreret |
| ~~TG-021~~ | 2026-10-08 | ~~`useEventForm`, `useBeerForm` og `useAuthForm` dublerer klientvalidering og fokuslogik. `FieldError` og `AuthField` viser fejl lidt forskelligt.~~ | Vedligeholdelse | En generisk `useActionForm` Status 2026-10-09: de rene hjælpere (`formDataToValues`, `validateFormData`, `firstInvalidField`) deles allerede, men ligger i `src/components/features/auth/form-validation.ts`. Kun `useEventForm`/`useBeerForm` fokuserer server-fieldErrors (D-056). Håndkodede varianter: opret klub, join-kode, profilnavn. **Gøres i starten af runde 3**, før sang-, steds- og kælenavnsformularerne: `useActionForm` baseret på `useEventForm`, og `useAuthForm` porteres sidst sammen med auth-E2E. ✅ Løst 2026-10-09 af D-109: `useActionForm` i `src/components/features/forms/` bruges af event-, øl-, opret klub-, auth-, profil-, password-, klubinfo- og stedformularerne. JoinCodeForm bevarer sin egen validering (navigation, ingen action). |
| TG-022 | 2026-10-08 | "Øllens event er i samme klub" har ingen garanti i databasen (D-073) | En fejl i datalaget kunne knytte på tværs af klubber | Evt. en DB-trigger senere. Note 2026-10-09: steder, ejere og events har nu sammensatte FK'er (D-096); øl har det stadig ikke. |
| ~~TG-023~~ | 2026-10-08 | ~~`RATE_LIMIT_DISABLED="1"` står midlertidigt i `.env.local` (F-020)~~ | Lokal rate limiting er slået fra | Fjernes, når runde 2 er færdig ✅ Fjernet 2026-10-08. Sat midlertidigt igen til runde 2-review og fjernet igen 2026-10-09. |
| TG-024 | 2026-10-08 | Kalenderlisten henter alle kommende events uden paging | Fint for en klub | Paging, hvis det bliver nødvendigt |
| ~~TG-025~~ | 2026-10-08 | ~~`songs/loading.tsx` dækker hele `songs`-mappen~~ | Detaljesider for sange vil give en blød 404 | Runde 3: flyt listen ind i `songs/(list)/` efter D-065 ✅ Løst 2026-10-13 af D-127. |
| TG-026 | 2026-10-08 | "I aften! 🍻" bruges også om events tidligere på dagen (§9.1 som skrevet) | Underligt ved frokostsmagninger | Genbesøg, hvis klubben holder dagsmagninger |
| ~~TG-027~~ | 2026-10-08 | ~~Runde 2's adversarial review (5 dimensioner → verifikation → rettelser → slut-gates) blev stoppet efter Jespers ønske, før der kom fund. Hurtig kontrol bestået: check, integration, DoD-E2E for runde 1+2.~~ | Runde 2 er ikke reviewet så grundigt som runde 1 | Kør review'et, før runde 3 starter (workflow-scriptet `r2-review` kan genkøres) ✅ Løst 2026-10-09: review kørt, fund R2-01–R2-21 rettet, slut-gates grønne. |
| ~~TG-028~~ | 2026-10-09 | ~~`src/server/actions/clubs.ts` (runde 1) kalder stadig `revalidatePath(..., "layout")` direkte i stedet for `revalidateClub` (D-090)~~ | Kun konsistens | Én linje, når filen alligevel røres ✅ Løst 2026-10-09 i runde 3 (`revalidateClub`/`revalidateAppShell` og det fælles `idSchema`). |
| ~~TG-029~~ | 2026-10-09 | ~~`cleanUserName` i Better Auths user-update-hook fjerner ikke NUL~~ | Ingen i dag: alle app-stier parser med `userNameSchema` først | Brug `stripNul` i `cleanUserName`, når filen røres ✅ Løst 2026-10-09 i runde 3. |
| TG-030 | 2026-10-09 | Ingen rate limits på runde 2-skrivninger (events, øl, ratings) | Et autentificeret medlem kunne fylde databasen via sin egen klub. Afvist som runde 2-fejl, fordi §4.7 ikke kræver det. | Overvej limits pr. bruger, hvis appen bliver offentligt kendt |
| ~~TG-031~~ | 2026-10-09 | ~~§9.7.1's PollForm-wireframe skriver "Tema (valgfri)"~~ | Forkert køn (et tema) | Brug "Tema (valgfrit)" i PollForm i runde 4, som i eventformularen ✅ Løst 2026-10-14 (D-135, §9.7.1 rettet). |
| ~~TG-032~~ | 2026-10-09 | ~~`events.location_text` og `events_location_text_length_check` findes stadig (nullable, ubrugt) efter D-097~~ | Død kolonne | Drop kolonnen og CHECK'en i runde 4's første migrering. Først skal `grep -rn locationText src --exclude-dir=generated` være tom (e2e-hjælperens alias og migreringstesten tæller ikke). ✅ Løst 2026-10-14 af D-139 (droppet i `round4_polls`). |
| TG-033 | 2026-10-09 | ~~Email kan ikke ændres (D-106, Q13)~~ Opdateret 2026-10-18: email kan ændres (D-151), men den nye email verificeres ikke, og den gamle adresse får ingen besked | En tastefejl kan låse de andre enheder ude; et overtaget login, der skifter email, opdages ikke via mail | ~~Byg email-ændring med verificering, når SMTP og et domæne er sat op (TG-001)~~ Verificér den nye email og giv besked til den gamle, når SMTP og et domæne findes (TG-001) |
| ~~TG-034~~ | 2026-10-09 | ~~En ren Google-konto kan ikke tilføje et password~~ | ~~Kan kun logge ind med Google~~ | ~~Byg det med et friskhedstjek (fx nyligt Google-login), da Better Auths `setPassword` ikke har et~~ ✅ Løst 2026-10-18 af D-152: "Tilføj password" kræver et Google-login under 10 minutter gammelt. |
| TG-035 | 2026-10-09 | Et kælenavn kan efterligne et andet medlems navn | Forvirring i en klub | Afbødet: medlemslisten og profilen viser det officielle navn i parentes (D-105). Genbesøg, hvis det bliver et problem. |
| TG-036 | 2026-10-09 | D-097-migreringens `lower()` følger databasens `LC_CTYPE` (C.UTF-8 på dev, test og Neon; C på `olklubben_itest`) | Engangs. I værste fald et ekstra sted, der kan arkiveres | Ingen. Migreringstesten låser C.UTF-8. |
| TG-037 | 2026-10-09 | Stedvælger og værtsvalg før hydrering (TG-020-klassen) | Uden JS følger værtskortene og hjælpeteksten ikke et stedskift (det viste sendes) | Stort set løst af D-113 (valg før hydrering overtages, valg efter et serversvar sættes tilbage). Ejer-toggle, admins X og slet/arkivér-dialogerne virker kun med JS, som alle `ConfirmDialog` (TG-020). |
| TG-038 | 2026-10-09 | Et muligt 40P01-deadlock mellem `deleteClub` og samtidige skrivninger i klubben | Viser den generiske fejl; intet går tabt | Fast låserækkefølge og små transactions gør det usandsynligt. Genbesøg, hvis det ses i logs. |
| ~~TG-039~~ | 2026-10-09 | ~~Toasts på CenteredShell-sider (desktop) står på oliven-båndet, og den mørke toast skiller sig kun ud med sin kant~~ | Svag visuel adskillelse af "club-left"/"club-deleted" på /clubs og /onboarding (D-104) | ✅ Løst 2026-10-09 af D-117: messingkant på olivenfarvede toasts. |
| ~~TG-040~~ | 2026-10-09 | ~~`e2e/club-isolation.spec.ts` bruger `/c/<id>/polls` som den ubyggede sti, der dækker catch-all'en `[...rest]` for medlemmer~~ | Når runde 4 bygger `/polls`, mister catch-all'en sin E2E-dækning | Skift til en anden ubygget sti i runde 4 (det samme skete for `places` i runde 3) ✅ Løst 2026-10-14: `stats` er den ubyggede sti; `/polls` (uden oversigt) og afstemninger fra andre klubber er tilføjet (ikke kørt endnu, TG-053). |
| TG-041 | 2026-10-09 | En styret `ConfirmDialog` uden trigger kan ikke selv returnere fokus (F-060) | Hvert menu → dialog-flow skal huske det selv | `MemberActionsMenu` gør det med en effekt. Tilføj en `returnFocusRef`-prop (via `onCloseAutoFocus`), når et andet flow får brug for det. |
| TG-042 | 2026-10-09 | `ProfileForm` er keyed på de gemte værdier. Gemmer man de samme værdier med ekstra mellemrum ("  Kaptajnen  "), bliver den urensede tekst stående i feltet | Kosmetisk, indtil næste besøg | Nulstil formularen efter et svar uden ændring, hvis det generer |
| TG-043 | 2026-10-13 | Sangbogen har ingen automatiske tests (D-119): hverken unit tests af `song-text`/`search`/`title`, integrationstests af actions og import eller E2E (søgning, læsevisning, admin, 404 for medlemmer) | Regressioner i sangbogen opdages først manuelt | Når Jesper har testet: unit tests af de rene moduler, `songs.itest.ts` og en `songbook.spec.ts` med de opdigtede seed-sange (`insertSong` findes i `e2e/support/db.ts`) |
| TG-044 | 2026-10-13 | En tekstlinje, der kun er "A" eller "E" (eller "Kor"/"Solo"), vises som akkord eller etiket | Sjældent forkert visning | Afbødet af `\`-escape og forhåndsvisningen |
| TG-045 | 2026-10-13 | Listesiden sender alle sanges tekstlinjer til klienten (D-123) | Over ca. 300 sange bliver siden tung | Flyt `matchSongs` til serveren, hvis sangbogen vokser så meget |
| TG-046 | 2026-10-13 | Akkordkolonnerne i 4 importerede sange med akkorder over ordene er estimeret ud fra PDF'ens positioner (204 akkorder: 8 midt i et ord, 9 efter linjens slutning, 0 på et mellemrum) | Enkelte akkorder kan sidde lidt skævt | Jesper tjekker dem manuelt og retter i appen eller via `overrides.json` |
| TG-047 | 2026-10-13 | Prototypens filer med sangtekster (`.work/songbook/`: `parsed.json`, `txt/`, `xml/`, preview) og `data/sangbog/import-report.json` ligger stadig lokalt (git-ignoreret) | Ingen, så længe de ikke committes | Slet `.work/songbook/` efter Jespers test |
| ~~TG-048~~ | 2026-10-13 | ~~Én sang har pladsholderen "X" i teksten, og to titler er rettet via `overrides.json` (afventer Jespers svar)~~ | Teksten står med "X" | Når Jesper svarer: en `replacements`-post i `overrides.json` og `--apply` igen (forventet: OPDATERES for den ene sang) ✅ Løst 2026-10-14 af D-140: Jesper beholder begge, som de er. |
| TG-049 | 2026-10-13 | Importen: en række i etiket-skriften, hvis tekst i parentes kun er akkordnavne, får ingen dansk etiket (`danishLabel` er ikke eksporteret fra `song-text.ts`), så round trip'en ville melde FEJL | Rammer ingen af de 59 sange | Eksportér `danishLabel`, hvis det sker |
| TG-050 | 2026-10-14 | Afstemninger lukker kun dagligt via cron (Hobby, kl. 04:00 UTC) ud over lazy close | Uden besøg kan et event fra en afstemning dukke op op til ca. et døgn efter fristen | Pro-planen eller en ekstern scheduler (fx Upstash QStash), hvis præcis lukning bliver vigtig |
| TG-051 | 2026-10-14 | Ingen notifikationer om nye afstemninger, frister eller oprettede events (§9.7.8 [SENERE]) | Overblik er den eneste påmindelse ("Du mangler at stemme") | Byg sammen med email (TG-001) eller push |
| TG-052 | 2026-10-14 | "noDateWorks ⇒ ingen DATE-kryds" er kun en app-regel, ikke en database-constraint | En fejl i datalaget kunne gemme en selvmodsigende stemmeseddel | Evt. en trigger senere. `checkBallotChoice` og integrationstestene dækker reglen |
| ~~TG-053~~ | 2026-10-14 | ~~Runde 4's E2E er skrevet, men ikke kørt (Jesper: "stop før du starter end to end test"): `e2e/round4-dod.spec.ts`, `e2e/polls.spec.ts`, `e2e/poll-lifecycle.spec.ts` og de nye dele af `e2e/club-isolation.spec.ts`~~ | Locators og flows er ikke verificeret; runde 4 er ikke ✅ | Kør `npm run test:e2e`, når Jesper giver lov, ret fejl og markér 4.1/4.2 ✅. P2's mobile månedstest klikker den første dag med "1 mulig dato" (skrøbelig, hvis en afstemningsdato falder på en eventdag) ✅ Løst 2026-10-18 (D-154): `polls.spec.ts` blev kørt først (18/18 to gange, F-080), derefter hele suiten med `round4-dod` 6/6, `poll-lifecycle` 16/16 og `club-isolation` 8/8: 214/214 to kørsler i træk. Den mobile månedstest trykker nu på dagen med dens fulde navn (F-081). 4.1 og 4.2 er ✅. |
| TG-054 | 2026-10-14 | `PlaceChoiceCard` har fået en checkbox-variant (`type`, `name`) i stedet for en generisk `ChoiceCard` | Komponentens navn og kommentarer handler stadig mest om radioen | Udskil en generisk `ChoiceCard`, hvis en tredje formular får brug for kortene |
| TG-055 | 2026-10-14 | Ingen rate limits på afstemningernes skrivninger (TG-030-klassen) | Et medlem kunne oprette mange afstemninger i sin egen klub | Som TG-030 |
| TG-056 | 2026-10-14 | `PollEditForm` er en klientkomponent, der får hele `PollView` (med vælgerne) som prop; `OverviewPollItem` har hverken `closeReason` eller hvem der valgte efter en uafgjort | Lidt mere data til klienten end nødvendigt; det afgjorte Overblik-kort kan ikke sige "Alle havde stemt" | Et reduceret prop og felterne i forespørgslen, hvis det bliver nødvendigt. Note 2026-10-18 (D-153): med 0 stemmer får formularen også klubbens steder (`listPlaceOptions`). |
| TG-057 | 2026-10-16 | Feedbacklisten viser højst 200 rapporter, og "lignende rapporter" matcher mod de 300 nyeste i browseren (D-144). Søgning i titel og beskrivelse er stadig [SENERE] (§9.9). | Ældre rapporter forsvinder fra listen og fra dublet-forslagene, når der er mange | Paging og søgning på serveren, når der er over ca. 200 rapporter |
| TG-058 | 2026-10-16 | Ingen rate limit på 👍 og på rettelser af feedback (kun på nye rapporter, 10/døgn) | En bruger kan toggle 👍 og rette sin nye rapport uden grænse | Som TG-030: limits pr. bruger, hvis det bliver misbrugt |
| TG-059 | 2026-10-16 | "Ingen 👍 på egen rapport" er ingen database-constraint; den håndhæves af selve INSERT'en (`setFeedbackVote`, D-145) | En ny skrivevej uden om datalaget kunne stemme på egen rapport | Evt. en trigger senere. Integrationstesten dækker både action og datalag |
| TG-060 | 2026-10-16 | En email i `APP_ADMIN_EMAILS` uden konto kan registreres af hvem som helst, fordi signup ikke verificerer emails (D-029, TG-002) | Den, der registrerer adressen først, bliver app-admin | Opret altid kontoen, før emailen sættes (README og `.env.example` siger det). Løses helt med email-verificering (TG-001/TG-002) **2026-10-26 (D-165):** app-admin kræver nu en bekræftet email (Google-login eller "Forbind Google"), så en fremmed konto på adressen bliver ikke app-admin. Tilbage: adressen er optaget, indtil ejeren tager den tilbage (§6.4). |
| TG-061 | 2026-10-16 | En original, der senere selv markeres som dublet, efterlader sine dubletter pegende på sig (en kæde A → B → C). Markeringen afviser kun en original, der allerede er en dublet (D-145) | Detaljesiden viser kun ét led | Peg dubletterne om til den nye original i samme transaction, hvis det bliver forvirrende |
| ~~TG-062~~ | 2026-10-16 | ~~Feedbackens sider og E2E er ikke bygget endnu (server først, D-141–D-146)~~ | Feedback kan kun bruges via datalaget og scriptet | Næste batch: `/feedback`, `/feedback/new`, `/feedback/[feedbackId]`, redigering, links fra Profil og fejlsider, E2E ✅ Løst 2026-10-18 af D-147–D-150 (`e2e/feedback.spec.ts`). |
| TG-063 | 2026-10-18 | 👍-knappen og "Slet rapport" virker kun med JavaScript (TG-020-klassen, som ejer-toggle og alle `ConfirmDialog`). Formularerne (ny, ret, status) og filtrene virker uden. | Uden JS kan man ikke give 👍 eller slette | Accepteret som for ejer-toggle (D-115). En `<form>`-fallback, hvis det bliver et problem |
| ~~TG-064~~ | 2026-10-18 | ~~"Skift email" kan pege på en andens adresse, som ingen konto har (D-151). Logger ejeren af adressen senere ind med Google, kobles Google på kontoen (samme klasse som TG-002)~~ | ~~Lav i en privat klub-app: kræver en konto med password og et bevidst valg af en andens email~~ | ~~Verificér den nye email (TG-033), før den gemmes eller kobles~~ ✅ Løst 2026-10-26 af D-165: ingen automatisk kobling, "Skift email" kobler Google fra, og en kobling afvises, hvis kontoens email er skiftet undervejs. |
| TG-065 | 2026-10-18 | To ting har ingen E2E: "Log ind med Google igen" (`GoogleSignInButton` med `loginHint`, D-152), fordi Google ikke er sat op i dev og E2E, og linket "Rapportér denne fejl" i `global-error.tsx` (D-150), fordi testene ikke fremtvinger en fejl i rodlayoutet. | En fejl i Googles round trip efter "Tilføj password" eller i den globale fejlsides link opdages først i brug | Google-delen testes manuelt sammen med TG-011, når `GOOGLE_*` er sat op. Den globale fejlside er dækket af kodegennemgang og unit tests af `newFeedbackHref` |

## 19.6 Dokumenthistorik

| Version | Dato | Ændring |
|---|---|---|
| v1 | – | Oprindelig tekst af Jesper |
| v2 | 2026-10-04 | Omstruktureret og uddybet: ordliste, arkitektur, rettighedsmatrix, routing, detaljerede feature-specs, livscyklus for afstemninger, datamodel med constraints, samlet edge case-tabel, designtokens, tests, åbne spørgsmål og AI-agent-sektion. |
| v2.1 | 2026-10-04 | Q2–Q4 afklaret: globalt kælenavn, kryds ved alle datoer der passer, fuldt åbne stemmer. Sangbogsimport tilføjet. |
| v2.2 | 2026-10-04 | Deployment på Vercel besluttet: nyt §4.8 (Neon, regioner, miljøer, migrations, OAuth på previews, env vars, cron-begrænsning på Hobby, rate limiting). |
| v2.3 | 2026-10-04 | Intet eget domæne indtil videre: email via Gmail SMTP med udskifteligt interface, admin-nulstillingslink som fallback, TG-001 tilføjet. |
| v2.4 | 2026-10-04 | Owner-rollen fjernet: kun Admin + Member, opretteren bliver Admin, regel om mindst én admin (§5, §7, §11, §12). |
| v2.5 | 2026-10-04 | Ny feature §9.9 Feedback: fejlrapporter og feature-ønsker i databasen, synlige for alle, 👍, status styret af app-admin. |
| v2.6 | 2026-10-08 | Implementeringsplan i fire runder (§16.3, D-020–D-024). Status (§19.2) organiseret efter runder. Q10–Q11 tilføjet. |
| v2.7 | 2026-10-08 | Runde 1-fundament: implementeringsnoter i §11 og §4.8, D-025–D-034, F-001–F-011, TG-002–TG-007. |
| v2.8 | 2026-10-08 | Runde 1-features: D-035–D-044, F-012–F-021. |
| v2.23 | 2026-10-28 | Auth0 Universal Login via Better Auths `genericOAuth` (ikke `@auth0/nextjs-auth0`), eksterne logins gjort generelle, log ud også fra Auth0 (D-166). §4.1, §4.7, §4.8, §6.2, §9.8. |
| v2.22 | 2026-10-26 | Invitationslinket pegede på et fejlet deploy: base-URL fra `VERCEL_PROJECT_PRODUCTION_URL` i produktion (D-164, F-085). Google-login slået sikkert til uden Auth0: ingen automatisk kobling, "Forbind Google" på Profil, emailskift kobler Google fra, app-admin kræver bekræftet email, ubrugte endpoints lukket (D-165, F-086). TG-002, TG-003 og TG-064 løst. §4.7, §4.8, §6.2–6.4, §9.8, §9.9, E19. |
| v2.21 | 2026-10-22 | Sikkerhedsopgradering af Next.js 16.4.0 → 16.4.2 med `experimental.agentUpgrade: "security"` (D-155). F-083 (arvet dev-servermiljø under opgraderingen), TG-005 genbesøgt. 1093 unit (91 filer), 339 integration (15 filer), build grøn, 214/214 E2E. §19.2 opdateret. |
| v2.20 | 2026-10-18 | Fuld E2E-gennemgang efter Jespers instruks (D-154): de manglende MVP-features er bygget (Feedback, skift email, tilføj password, ret datoer og steder før første stemme), og hele suiten er grøn to kørsler i træk: 214/214 (107 tests × desktop/375 px). Runde 4 (4.1, 4.2), Feedback og Profil er ✅. F-081 (tre skrøbelige tests, ingen appfejl), F-082 (dvale midt i en kørsel), TG-053 løst, TG-065. 1093 unit (91 filer), 339 integration (15 filer), build grøn, titel-grep 0 fund. §16.3 og §19.2 opdateret. |
| v2.19 | 2026-10-18 | Afstemninger: datoer, starttid og steder kan rettes, indtil den første stemme er afgivet (D-153 erstatter D-133), uden skemaændring. F-080. §5.1, §8.2, §9.7.2, §11, §12 (E24, E37), §13.5 opdateret. 1093 unit (91 filer), 339 integration (15 filer), build grøn, `polls.spec.ts` 18/18 to gange. |
| v2.18 | 2026-10-18 | Profil: "Skift email" (D-151) og "Tilføj password" for rene Google-konti (D-152), uden skemaændring. D-151–D-152, F-079, TG-064; TG-034 løst, TG-033 omformuleret, Q13 afklaret, dele af D-106 erstattet. §4.7, §6.4, §9.8, §12 (E35–E36), §13.5, §14, §16.1, §18 opdateret. 1077 unit (91 filer), 328 integration (15 filer), build grøn, `profile.spec.ts` + `form-focus.spec.ts` 12/12 to gange. |
| v2.17 | 2026-10-18 | Feedback (§9.9), siderne: `/feedback` (filtre i URL'en, tomme tilstande), `/feedback/new` (type, side uden klub-id, "Findes den allerede?"), detaljesiden (👍, ret/slet, teknisk info og status/svar/dublet for app-admin), redigering, skeletons, 404 og fejlgrænse; ramme efter senest aktive klub med Profil markeret (FeedbackShell uden klubber); indgange fra Profil, footeren og "Rapportér denne fejl" på fejlsiderne; `formatRelativePast`. D-147–D-150, F-078, TG-063; TG-062 løst. §4.2, §8.1, §8.2, §9.9, §13.5, §14, §16.3 opdateret. 1056 unit (89 filer), 311 integration (14 filer), build grøn, `feedback.spec.ts` 20/20 (kørt alene). |
| v2.16 | 2026-10-16 | Feedback (§9.9), serveren: datamodel med 9 CHECKs, `APP_ADMIN_EMAILS` valideret ved opstart, rent domæne, Zod-schemas, datalag med betingede skrivninger og rækkelåse, 5 Server Actions, 10 rapporter/døgn, `scripts/list-feedback.ts`, seed. D-141–D-146, F-077, TG-057–TG-062. §4.2, §4.7, §4.8, §9.9, §11, §16.3 opdateret. 1031 unit (87 filer), 310 integration (14 filer), build grøn, drift-tjek tomt. Siderne følger. |
| v2.15 | 2026-10-14 | Runde 4 bygget (afstemninger): datamodel med sammensatte FK'er og 9 CHECKs, låse, én lukkefunktion bag sidste stemme, lazy close, manuel lukning og daglig cron (`CRON_SECRET`), uafgjort med valg, automatisk event, PollForm med forslag, stemme-UI med forhåndsvisning, Overblik-kort, stiplede datoer i Kalenderen, E5. D-129–D-140, F-075–F-076, TG-050–TG-056; TG-031, TG-032, TG-040 og TG-048 løst. §4.8, §5.1, §7.4, §7.5, §8.2, §9.1, §9.3, §9.4, §9.7, §11, §12 (E33, E34), §13.5, §14, §16.3 opdateret. 928 unit (78 filer), 281 integration (13 filer, heraf 84 nye i runde 4), build grøn, drift-tjek tomt. E2E skrevet, ikke kørt (TG-053). |
| v2.14 | 2026-10-13 | Sangbogen bygget i runde 3 (D-118 erstatter D-091): datamodel, sangtekstformat med akkorder, oversigt, søgning, læsevisning, admin og importscript; 59 sange importeret lokalt. Jesper tester sangbogen manuelt (D-119). D-118–D-128, F-071–F-074, TG-043–TG-049; TG-025 løst; Q5 afklaret. §4.2, §8.2, §9.6, §11, §13.5, §14, §16, §17, §18, §19.1 opdateret. 724 unit, 197 integration, build og 150/150 E2E. |
| v2.13 | 2026-10-09 | Runde 3 færdig (uden sangbogen, D-091): kælenavn, skift password, steder med ejere og arkivering, events med steder og værter, eventhistorik og medlemsadministration. D-094–D-117, F-053–F-070, TG-032–TG-042; TG-021, TG-028, TG-029 og TG-039 løst; D-061 og D-062 erstattet. §5.1, §7, §8, §9.1–9.4, §9.8, §11, §12 (E29–E32), §14, §16, §18 (Q13) opdateret. 724 unit, 197 integration, build og 150/150 E2E to kørsler i træk. |
| v2.12 | 2026-10-09 | Ny palet: oliven + havneblå (§13.2, D-092). Sidebar uden Profil-punkt (D-093). Sangbogen udskudt fra runde 3 (D-091). 527 unit, 64 integration, build og 100/100 E2E to kørsler i træk. |
| v2.11 | 2026-10-09 | Runde 2 færdig efter adversarial review (25 fund, 23 bekræftet og rettet): D-086–D-090, F-044–F-052, TG-027 løst, TG-028–TG-031. §8.2 har ølredigerings-routen. |
| v2.10 | 2026-10-08 | Runde 2 bygget: D-061–D-085, F-034–F-043, TG-018–TG-026. TG-008 og TG-009 løst. Q10/Q11 afklaret. |
| v2.9 | 2026-10-08 | Runde 1 færdig efter adversarial review (33 fund, alle rettet): D-045–D-060, F-022–F-033, TG-008–TG-017, Q12. §4.2, §4.8, §5.1, §6.4 opdateret. |
