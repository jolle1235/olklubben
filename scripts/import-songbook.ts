// Loads .env.local (or the shell's DATABASE_URL, which wins) like Next.js. Must stay first.
import "./load-env";

import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { nameKey } from "../src/lib/text";
import { pgConfig } from "../src/server/db/pg-config";
import { applyImportPlan, ConcurrentEditError, readClubSongs } from "./songbook/apply";
import { HELP, parseImportArgs, type ImportArgs } from "./songbook/cli-args";
import { findImportUser, listAdminClubs, loadImportClub } from "./songbook/club";
import {
  assertImportTarget,
  assertNotOnVercel,
  assertReportPath,
  GuardError,
  type ImportTarget,
} from "./songbook/guard";
import { loadOverrides, OverridesError } from "./songbook/overrides";
import { PDFTOHTML_MISSING, pdftohtmlVersion } from "./songbook/pdftohtml";
import { planSongImport, type PlanItem } from "./songbook/plan";
import * as report from "./songbook/report";
import { parseSongFile, type ParsedSong } from "./songbook/song";

/**
 * Imports the club's ChordBank songbook (PDFs in data/sangbog/visne-viser,
 * git-ignored) as Song rows (SPEC §9.6). Run locally: `npm run songbook:import -- --help`.
 *
 *   no --user           parse only: no database is touched
 *   --user              lists the clubs where the user is admin
 *   --user --club       TØR KØRSEL: prints the plan, writes nothing
 *   ... --apply         writes, in one transaction, never over edits made in the app
 *
 * Guards (scripts/songbook/guard.ts): never on Vercel; a non-local database
 * needs --remote, and --apply against it a club name typed at a TTY, so AI
 * agents can only import locally. Jesper runs the production import:
 *   DATABASE_URL=<Neon UNPOOLED url> npm run songbook:import -- \
 *     --user <email> --club <club id> --apply --remote
 *
 * Builds its own Prisma client like prisma/seed.ts (never @/server/db, whose
 * env check wants the auth secrets).
 */

const PROJECT_ROOT = resolve(__dirname, "..");

type Setup = {
  args: ImportArgs;
  poppler: string;
  dir: string;
  /** NFC file name → the name on disk. */
  files: Map<string, string>;
  selected: string[];
};

async function parseAll(setup: Setup): Promise<ParsedSong[]> {
  const known = new Set(setup.files.keys());
  const overrides = await loadOverrides(resolve(PROJECT_ROOT, setup.args.overrides), known, {
    optional: !setup.args.overridesGiven,
  });
  const songs: ParsedSong[] = [];
  for (const file of setup.selected) {
    songs.push(await parseSongFile(setup.dir, setup.files.get(file) ?? file, overrides));
  }
  return songs;
}

/** The target comes first, before anything is read or written. */
function printTarget(setup: Setup, target: string): void {
  console.log(`Mål: ${target}`);
  console.log(
    `${setup.poppler} · ${setup.files.size} PDF'er i ${setup.args.dir}` +
      (setup.args.only.length > 0 ? ` (kun ${setup.selected.length})` : ""),
  );
}

async function finish(
  setup: Setup,
  songs: ParsedSong[],
  extra: Record<string, unknown>,
): Promise<void> {
  report.printFindings(songs);
  const shown = songs.find((s) => s.file === setup.args.show);
  if (shown) report.printShow(shown);
  const path = assertReportPath(setup.args.report, PROJECT_ROOT);
  await report.writeJsonReport(path, {
    generatedAt: new Date().toISOString(),
    poppler: setup.poppler,
    songs,
    ...extra,
  });
  console.log(`Rapport: ${setup.args.report}`);
}

async function confirmAtTerminal(target: ImportTarget, clubName: string): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`Skriv klubbens navn for at importere til ${target.host}: `);
    if (nameKey(answer) !== nameKey(clubName)) {
      throw new GuardError("Navnet passer ikke. Intet skrevet.");
    }
  } finally {
    rl.close();
  }
}

async function withDatabase(setup: Setup, target: ImportTarget, db: PrismaClient): Promise<number> {
  const { args } = setup;
  const user = await findImportUser(db, args.user as string);
  console.log(`Bruger: ${user.email}`);
  if (!args.club) {
    const clubs = await listAdminClubs(db, user.id);
    console.log(`\nKlubber, hvor ${user.email} er admin:`);
    for (const c of clubs) {
      console.log(`  ${c.id}  ${c.name}  (${c.members} medlemmer, ${c.songs} sange)`);
    }
    if (clubs.length === 0) console.log("  (ingen)");
    return 0;
  }

  const club = await loadImportClub(db, user, args.club);
  console.log(
    `Klub: ${club.name} (${club.id}) · ${club.members} medlemmer · ${club.songs} sange · du er admin`,
  );
  console.log(args.apply ? "\nIMPORT – skriver til databasen\n" : "\nTØR KØRSEL – intet skrives\n");

  const songs = await parseAll(setup);
  const flags = {
    includeNew: args.includeNew,
    overwriteEdited: args.overwriteEdited,
    partial: args.only.length > 0,
  };
  const plan = planSongImport(await readClubSongs(db, club.id), songs, flags);
  report.printPlan(plan, songs);
  console.log(`\n${report.planSummary(plan)}`);

  let exitCode = songs.some((s) => s.errors.length > 0) ? 1 : 0;
  const summary = (p: PlanItem[]) =>
    p.map(({ song, ...rest }) => ({ ...rest, file: song?.file ?? null }));
  if (args.apply) {
    if (plan.some((i) => i.status === "FEJL")) {
      console.log("\nPlanen har FEJL – intet skrevet.");
      exitCode = 1;
    } else {
      if (target.needsConfirmation) await confirmAtTerminal(target, club.name);
      const result = await db.$transaction(
        async (tx) => {
          const fresh = planSongImport(await readClubSongs(tx, club.id), songs, flags);
          if (fresh.some((i) => i.status === "FEJL")) {
            throw new Error("Planen fik FEJL undervejs – intet skrevet.");
          }
          return applyImportPlan(tx, fresh, { clubId: club.id, userId: user.id });
        },
        { timeout: 60_000 },
      );
      console.log(`\nSkrevet: ${result.created} oprettet · ${result.updated} opdateret.`);
    }
  }
  await finish(setup, songs, {
    target: target.display,
    club: { id: club.id, name: club.name },
    plan: summary(plan),
  });
  if (!args.apply) console.log("\nTØR KØRSEL – intet skrevet. Kør igen med --apply for at skrive.");
  return exitCode;
}

async function main(): Promise<number> {
  const args = parseImportArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return 0;
  }
  assertNotOnVercel(process.env);
  assertReportPath(args.report, PROJECT_ROOT);
  const poppler = await pdftohtmlVersion();
  if (!poppler) throw new GuardError(PDFTOHTML_MISSING);

  const dir = resolve(PROJECT_ROOT, args.dir);
  const names = (await readdir(dir).catch(() => [] as string[]))
    .filter((f) => f.toLowerCase().endsWith(".pdf"))
    .sort((a, b) => (a.normalize("NFC") < b.normalize("NFC") ? -1 : 1));
  const files = new Map(names.map((f) => [f.normalize("NFC"), f] as const));
  if (files.size === 0) throw new GuardError(`Ingen PDF'er i ${args.dir}.`);
  for (const file of [...args.only, ...(args.show ? [args.show] : [])]) {
    if (!files.has(file)) throw new GuardError(`Findes ikke i ${args.dir}: «${file}» (typo?)`);
  }
  const all = [...files.keys()];
  const selected = args.only.length > 0 ? all.filter((f) => args.only.includes(f)) : all;
  const setup: Setup = { args, poppler, dir, files, selected };

  if (!args.user) {
    printTarget(setup, "ingen database (læser kun PDF'erne)");
    const songs = await parseAll(setup);
    console.log("");
    report.printParsedSongs(songs);
    await finish(setup, songs, { target: null });
    console.log("\nKun læst. Tilføj --user <email> --club <klub-id> for en tør kørsel.");
    return songs.some((s) => s.errors.length > 0) ? 1 : 0;
  }

  const interactive = process.stdin.isTTY === true && process.stdout.isTTY === true;
  const target = assertImportTarget(process.env.DATABASE_URL, process.env, {
    apply: args.apply,
    remote: args.remote,
    interactive,
  });
  printTarget(setup, target.display + (target.local ? " (lokal)" : " (FJERN)"));
  const db = new PrismaClient({
    adapter: new PrismaPg(pgConfig(process.env.DATABASE_URL as string)),
  });
  try {
    return await withDatabase(setup, target, db);
  } finally {
    await db.$disconnect();
  }
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    const known = error instanceof GuardError || error instanceof OverridesError;
    console.error(
      `\n${known || error instanceof ConcurrentEditError ? "" : "Fejl: "}${(error as Error).message}`,
    );
    process.exitCode = known ? 2 : 1;
  },
);
