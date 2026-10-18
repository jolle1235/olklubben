// Loads .env.local (or the shell's DATABASE_URL, which wins) like Next.js. Must stay first.
import "./load-env";

import { parseArgs } from "node:util";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { getFeedbackAuthorName } from "../src/lib/format/display-name";
import { pgConfig } from "../src/server/db/pg-config";
import { isLocalHost, seedTargetHost } from "../src/server/db/seed-target";
import { formatFeedbackList, type FeedbackCliItem } from "../src/server/domain/feedback/cli-format";
import { OPEN_FEEDBACK_STATUSES, type FeedbackType } from "../src/server/domain/feedback/status";
import { compareFeedbackByVotes, feedbackVoteCount } from "../src/server/domain/feedback/votes";
import { assertNotOnVercel, GuardError, maskDatabaseUrl } from "./songbook/guard";

/**
 * Prints the OPEN feedback reports (Ny, Planlagt, I gang), most 👍 first, from
 * the database in DATABASE_URL (SPEC §9.9 "AI-agent og feedback", D-146), so an
 * agent can read the users' backlog without the UI. READ-ONLY: only findMany
 * and count, never a write.
 *
 *   npm run feedback:list                       local database (.env.local)
 *   npm run feedback:list -- --type bug --json  bugs only, as JSON
 *   DATABASE_URL="<Neon URL>" npm run feedback:list -- --remote
 *
 * Guards: never on Vercel; a database that is not on this machine needs
 * --remote (no TTY confirmation, unlike the songbook importer: nothing is
 * written). The target is always printed first, with the password masked
 * (on stderr with --json, so stdout stays valid JSON). Authors are display
 * names ("Tidligere bruger" for a deleted account), never emails. The
 * technical info (browser, screen width) only with --with-tech.
 *
 * Builds its own Prisma client like prisma/seed.ts (never @/server/db, whose
 * env check wants the auth secrets).
 *
 * Exit codes: 0 OK · 1 error · 2 wrong arguments or a safety stop.
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 1000;

const HELP = `Vis åbne feedback-rapporter (fejl og ønsker) – SPEC §9.9

  npm run feedback:list -- [indstillinger]

Viser rapporter med status Ny, Planlagt eller I gang, flest 👍 først.
  --type bug|feature         Kun fejl (bug) eller kun idéer/ønsker (feature).
  --limit <antal>            Højst så mange rapporter (standard ${DEFAULT_LIMIT}, højst ${MAX_LIMIT}).
  --json                     Udskriv som JSON (en liste) i stedet for tekst.
  --with-tech                Medtag teknisk info (browser og skærmbredde).
  --remote                   Tillad en database, der ikke er lokal (fx produktion på Neon).
  -h, --help                 Denne hjælp.

Databasen er DATABASE_URL (fra .env.local eller shellen), fx:
  DATABASE_URL="<Neon URL>" npm run feedback:list -- --remote

Scriptet skriver aldrig til databasen.
Exit-koder: 0 OK · 1 fejl · 2 forkerte argumenter eller sikkerhedsstop.`;

type ListArgs = {
  help: boolean;
  remote: boolean;
  type: FeedbackType | null;
  limit: number;
  json: boolean;
  withTech: boolean;
};

const TYPE_ARGS: Record<string, FeedbackType> = { bug: "BUG", feature: "FEATURE" };

function parseListArgs(argv: readonly string[]): ListArgs {
  let values;
  try {
    ({ values } = parseArgs({
      args: [...argv],
      strict: true,
      allowPositionals: false,
      options: {
        help: { type: "boolean", short: "h", default: false },
        remote: { type: "boolean", default: false },
        type: { type: "string" },
        limit: { type: "string" },
        json: { type: "boolean", default: false },
        "with-tech": { type: "boolean", default: false },
      },
    }));
  } catch (error) {
    throw new GuardError(`${(error as Error).message}\n\n${HELP}`);
  }

  let type: FeedbackType | null = null;
  if (values.type !== undefined) {
    const known = TYPE_ARGS[values.type.trim().toLowerCase()];
    if (!known) throw new GuardError(`--type skal være bug eller feature.\n\n${HELP}`);
    type = known;
  }

  let limit = DEFAULT_LIMIT;
  if (values.limit !== undefined) {
    const text = values.limit.trim();
    limit = /^\d{1,4}$/.test(text) ? Number(text) : Number.NaN;
    if (!(limit >= 1 && limit <= MAX_LIMIT)) {
      throw new GuardError(`--limit skal være et helt tal fra 1 til ${MAX_LIMIT}.\n\n${HELP}`);
    }
  }

  return {
    help: values.help === true,
    remote: values.remote === true,
    type,
    limit,
    json: values.json === true,
    withTech: values["with-tech"] === true,
  };
}

/** The masked target, or a GuardError before anything connects. */
function assertListTarget(connectionString: string | undefined, remote: boolean): string {
  assertNotOnVercel(process.env, "Feedback-listen");
  if (!connectionString) {
    throw new GuardError("DATABASE_URL mangler. Sæt den i .env.local (se .env.example).");
  }
  const host = seedTargetHost(connectionString, process.env);
  const local = isLocalHost(host);
  if (!local && !remote) {
    throw new GuardError(
      `DATABASE_URL peger på "${host}", som ikke er en lokal database. ` +
        "Kør igen med --remote for at læse rapporterne derfra (scriptet skriver aldrig).",
    );
  }
  const { display } = maskDatabaseUrl(connectionString, process.env);
  return `${display}${local ? " (lokal)" : " (FJERN)"}`;
}

async function readOpenFeedback(
  db: PrismaClient,
  args: ListArgs,
): Promise<{ items: FeedbackCliItem[]; total: number }> {
  const where = {
    status: { in: [...OPEN_FEEDBACK_STATUSES] },
    ...(args.type ? { type: args.type } : {}),
  };
  const [rows, total] = await Promise.all([
    db.feedback.findMany({
      where,
      orderBy: [{ votes: { _count: "desc" } }, { createdAt: "desc" }, { id: "desc" }],
      take: args.limit,
      select: {
        id: true,
        type: true,
        status: true,
        title: true,
        description: true,
        pagePath: true,
        adminResponse: true,
        createdAt: true,
        createdBy: { select: { name: true, nickname: true } },
        _count: { select: { votes: true } },
        // `false` keeps the columns out of the query unless asked for.
        userAgent: args.withTech,
        viewportWidth: args.withTech,
      },
    }),
    db.feedback.count({ where }),
  ]);

  const items = rows.map((row): FeedbackCliItem => ({
    id: row.id,
    type: row.type,
    status: row.status,
    title: row.title,
    description: row.description,
    pagePath: row.pagePath,
    adminResponse: row.adminResponse,
    authorName: getFeedbackAuthorName(row.createdBy),
    upvotes: feedbackVoteCount(row._count.votes),
    createdAt: row.createdAt,
    ...(args.withTech
      ? { userAgent: row.userAgent ?? null, viewportWidth: row.viewportWidth ?? null }
      : {}),
  }));
  items.sort((a, b) =>
    compareFeedbackByVotes(
      { id: a.id, voteCount: a.upvotes, createdAt: a.createdAt },
      { id: b.id, voteCount: b.upvotes, createdAt: b.createdAt },
    ),
  );
  return { items, total };
}

async function main(): Promise<number> {
  const args = parseListArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return 0;
  }

  const target = assertListTarget(process.env.DATABASE_URL, args.remote);
  // With --json the target goes to stderr, so stdout is only the JSON.
  (args.json ? console.error : console.log)(`Mål: ${target}`);

  const db = new PrismaClient({
    adapter: new PrismaPg(pgConfig(process.env.DATABASE_URL as string)),
  });
  try {
    const { items, total } = await readOpenFeedback(db, args);
    if (args.json) {
      console.log(
        JSON.stringify(
          items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
          null,
          2,
        ),
      );
      return 0;
    }
    console.log("");
    console.log(formatFeedbackList(items, { withTech: args.withTech }));
    if (total > items.length) {
      console.log(`(viser de ${items.length} med flest 👍 af ${total} – brug --limit for flere)`);
    }
    return 0;
  } finally {
    await db.$disconnect();
  }
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    const known = error instanceof GuardError;
    console.error(`\n${known ? "" : "Fejl: "}${(error as Error).message}`);
    process.exitCode = known ? 2 : 1;
  },
);
