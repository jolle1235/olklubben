import { parseArgs } from "node:util";

import { isValidId } from "../../src/lib/ids";

import { GuardError } from "./guard";

/** Command-line options of scripts/import-songbook.ts (Danish help with --help). */

export const DEFAULT_DIR = "data/sangbog/visne-viser";
export const DEFAULT_OVERRIDES = "data/sangbog/overrides.json";
export const DEFAULT_REPORT = "data/sangbog/import-report.json";

export const HELP = `Importér sangbogen (ChordBank-PDF'er) – SPEC §9.6

  npm run songbook:import -- [indstillinger]

Uden --user og --club læses PDF'erne kun (ingen database).
  --user <email>             Med --club: tør kørsel (intet skrives). Alene: vis klubber, hvor du er admin.
  --club <klub-id>           Klubben, der importeres til (kræver --user).
  --apply                    Skriv til databasen (kræver --user og --club).
  --only "<fil.pdf>"         Kun denne fil (kan gentages).
  --show "<fil.pdf>"         Udskriv hele den gemte tekst for én sang.
  --include-new              Opret også sange med status NY? (slettet i appen eller ny fil).
  --overwrite-edited         Overskriv sange, der er ændret i appen (kun sammen med --only).
  --remote                   Tillad en database, der ikke er lokal (kun Jesper, kræver en terminal).
  --dir <mappe>              PDF-mappen (standard ${DEFAULT_DIR}).
  --overrides <fil>          Rettelser (standard ${DEFAULT_OVERRIDES}).
  --report <fil>             JSON-rapport under data/ (standard ${DEFAULT_REPORT}).
  -h, --help                 Denne hjælp.

Exit-koder: 0 OK · 1 FEJL eller afvist import · 2 forkerte argumenter eller sikkerhedsstop.`;

export type ImportArgs = {
  help: boolean;
  dir: string;
  overrides: string;
  overridesGiven: boolean;
  only: string[];
  show: string | null;
  report: string;
  user: string | null;
  club: string | null;
  apply: boolean;
  includeNew: boolean;
  overwriteEdited: boolean;
  remote: boolean;
};

/** Throws GuardError (exit 2) for unknown options or a combination that makes no sense. */
export function parseImportArgs(argv: readonly string[]): ImportArgs {
  let values;
  try {
    ({ values } = parseArgs({
      args: [...argv],
      strict: true,
      allowPositionals: false,
      options: {
        help: { type: "boolean", short: "h", default: false },
        dir: { type: "string" },
        overrides: { type: "string" },
        only: { type: "string", multiple: true },
        show: { type: "string" },
        report: { type: "string" },
        user: { type: "string" },
        club: { type: "string" },
        apply: { type: "boolean", default: false },
        "include-new": { type: "boolean", default: false },
        "overwrite-edited": { type: "boolean", default: false },
        remote: { type: "boolean", default: false },
      },
    }));
  } catch (error) {
    throw new GuardError(`${(error as Error).message}\n\n${HELP}`);
  }

  const args: ImportArgs = {
    help: values.help === true,
    dir: values.dir ?? DEFAULT_DIR,
    overrides: values.overrides ?? DEFAULT_OVERRIDES,
    overridesGiven: values.overrides !== undefined,
    only: (values.only ?? []).map((f) => f.normalize("NFC")),
    show: values.show?.normalize("NFC") ?? null,
    report: values.report ?? DEFAULT_REPORT,
    user: values.user?.trim().toLowerCase() || null,
    club: values.club?.trim() || null,
    apply: values.apply === true,
    includeNew: values["include-new"] === true,
    overwriteEdited: values["overwrite-edited"] === true,
    remote: values.remote === true,
  };

  if (args.club && !args.user) throw new GuardError("--club kræver --user <email>.");
  if (args.club && !isValidId(args.club)) {
    throw new GuardError(`--club er ikke et gyldigt klub-id: "${args.club}".`);
  }
  if (args.apply && !(args.user && args.club)) {
    throw new GuardError("--apply kræver både --user og --club.");
  }
  if (args.overwriteEdited && args.only.length === 0) {
    throw new GuardError("--overwrite-edited må kun bruges sammen med --only.");
  }
  return args;
}
