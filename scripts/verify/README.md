# Verify-harness

Isolerede instanser af den rigtige app til bevis på en ændring (før/efter, review). Bruges af
flow-skillsene via `.claude/flow/profile.md` → Verify; feature-kortet ligger i
`.claude/flow/features/`.

```sh
npm run verify:up -- --id <id> [--ref <sha>]   # start (eller genbrug) en instans, printer READY <id> <url>
npm run verify:doctor -- --id <id>             # read-only sundhedstjek
npm run verify:smoke -- --id <id>              # driver hvert kortlagt feature én gang
npm run verify:down -- --id <id>               # stop og ryd op (evidens bliver)
npm run verify:down -- --all
npm run verify:list
```

## Hvad en instans er

- **Kode:** en git worktree i `~/.cache/olklubben-verify/<id>/app` (`VERIFY_HOME` flytter den) på
  `--ref`, ellers på `HEAD` plus arbejdstræets ændringer (også nye, ikke-ignorerede filer). `up` med
  samme id synker arbejdstræet igen, og `next dev` genindlæser. `node_modules` er hardlinket fra
  repoet. Worktree'en ligger uden for repoet, fordi `next dev` skriver i kopiens `tsconfig.json`, og
  Turbopack ikke følger et symlink ud af sin rod.
- **Database:** `olklubben_verify_<id>` på den lokale Postgres (`VERIFY_PG_URL`, standard
  `postgresql://postgres@localhost:5432/postgres`, kun localhost), droppet og oprettet ved `up`,
  migreret og seedet med kopiens egen `prisma/seed.ts`.
- **Server:** `next dev` på den første ledige port i 3200–3299 med `NODE_ENV=test` og et komplet miljø
  sat af harnessen. Kopien har ingen `.env`-filer. Mails skrives til instansens outbox.
- **Markør:** `up` opretter brugeren `verify-<id>@example.test` gennem appen. Doctor logger ind som
  den, og det lykkes kun, når serveren læser instansens egen database.
- **Evidens:** `.flow/verify/<id>/` (screenshots fra smoke, `server.log` kopieret ved `down`).
  Per-opgave-evidens i `.flow/<slug>/evidence/`. Begge er gitignored og overlever `down`.

Flere instanser kan køre side om side (egen worktree, port, database og outbox).

## Driver

`driver.ts` er det, et check-script importerer:

```ts
import { createReport, openApp } from "../../scripts/verify/driver";
import { BEERS, CLUBS } from "../../scripts/verify/fixtures";

const app = await openApp(id, {
  as: "jesper",
  viewport: "mobile",
  evidence: ".flow/<slug>/evidence",
});
await app.goto(`/c/${CLUBS.drengene.id}/beers/${BEERS.westmalle.id}`);
await app.shot("westmalle");
const rows = await app.sql("SELECT value FROM beer_ratings WHERE beer_id = $1", [
  BEERS.westmalle.id,
]);
const problems = app.problems(); // konsolfejl, sidefejl, fejlede requests, 5xx
await app.close();
```

`as`: `"jesper" | "mads" | "anders"`, `{ email, password }` eller `null` (logget ud). Login sker
gennem Better Auths API. `createReport()` skriver `PASS|FAIL <navn> | <detalje>` og `PROBLEM <tekst>`
og afslutter med exit 1 ved fejl.

## Fixtures

Seedet i `prisma/seed.ts`, med de faste id'er, check-scripts bruger, i `fixtures.ts`. Den fulde tabel
står i README.md "Testbrugere". Alt er opdigtet, også sangene. Password for alle: `olklubben123`.

| Konstant                          | Hvad                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------- |
| `USERS.jesper`                    | "Kaptajnen". Admin i Drengene & Bajere, medlem af Torsdagsklubben, app-admin |
| `USERS.mads`                      | Medlem af Drengene & Bajere, admin i Torsdagsklubben. Lander i klubvælgeren  |
| `USERS.anders`                    | Kun medlem af Drengene & Bajere                                              |
| `CLUBS.drengene`, `CLUBS.torsdag` | De to klubber                                                                |
| `EVENTS.next13`                   | Om 3 dage, Hos Jesper, oprettet af en afstemning                             |
| `EVENTS.past12`                   | For 3 uger siden, fire øl                                                    |
| `BEERS.westmalle`                 | 3 ratings, Kaptajnens er 5                                                   |
| `BEERS.mikkeller`                 | Ingen ratings, intet event                                                   |
| `POLLS.open`                      | Åben, Kaptajnen mangler at stemme                                            |
| `POLLS.tie`                       | Uafgjort om stedet i Torsdagsklubben                                         |
| `SONGS.skaal`, `SONGS.aalborg`    | Opdigtede sange i Torsdagsklubben                                            |

Datoer er relative til den dag, instansen blev startet. `verify:smoke` fejler, hvis seed og
`fixtures.ts` glider fra hinanden.
