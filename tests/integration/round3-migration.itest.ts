import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { pgConfig } from "@/server/db/pg-config";
import { placeNameKey } from "@/server/domain/places/name";

import { assertItestDatabaseUrl, withDatabaseName } from "./env.mjs";

/**
 * The round-3 migration's data section (D-022 → places, D-097) on a scratch
 * database: rounds 1–2 are applied, round-2 style events are inserted, and
 * then the round-3 SQL runs exactly as `prisma migrate deploy` would send it.
 *
 * The scratch database is C.UTF-8 like olklubben_dev/_test and Neon (lower()
 * follows LC_CTYPE, TG-036). It is separate from olklubben_itest (the global
 * setup's database) and is dropped afterwards.
 */

const itestUrl = assertItestDatabaseUrl(process.env.DATABASE_URL);
const SCRATCH_DB = "olklubben_r3mig_itest";
const scratchUrl = withDatabaseName(itestUrl, SCRATCH_DB);
const maintenanceUrl = withDatabaseName(itestUrl, "postgres");

const MIGRATIONS_DIR = path.join(process.cwd(), "prisma", "migrations");
const ROUND3_SUFFIX = "_round3_places_hosts_nickname";

function migrationDirs(): string[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function readMigration(dir: string): string {
  return readFileSync(path.join(MIGRATIONS_DIR, dir, "migration.sql"), "utf8");
}

const dirs = migrationDirs();
const round3Index = dirs.findIndex((dir) => dir.endsWith(ROUND3_SUFFIX));
const round3Sql = round3Index === -1 ? "" : readMigration(dirs[round3Index] ?? "");

/** The migration's own whitespace class (the regex literal in the name expression). */
function migrationWhitespaceClass(): string {
  const match = /'(\[\[:space:\][^']*\])\+'/.exec(round3Sql);
  if (!match?.[1]) throw new Error("Fandt ikke whitespace-klassen i round-3-migrationen.");
  return match[1];
}

async function withClient<T>(url: string, run: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client(pgConfig(url));
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

async function dropScratch(): Promise<void> {
  await withClient(maintenanceUrl, (client) =>
    client.query(`DROP DATABASE IF EXISTS "${SCRATCH_DB}" WITH (FORCE)`),
  );
}

// ── Fixtures ────────────────────────────────────────────────────────────────

const ids = {
  early: randomUUID(),
  late: randomUUID(),
  clubA: randomUUID(),
  clubB: randomUUID(),
  clubC: randomUUID(),
};

const LONG_TEXT = `Langt sted ${"ø".repeat(109)}`; // 120 characters
const NBSP_ONLY = "\u00a0\u00a0";

type EventFixture = {
  club: string;
  creator: string;
  text: string;
  startsAt: string;
  createdAt: string;
};

/** Round-2 events: location_text as members typed it. */
const EVENTS: EventFixture[] = [
  // Club A: four spellings of "Hos Mads". The earliest one was created by `early`.
  {
    club: ids.clubA,
    creator: ids.early,
    text: "HOS Mads",
    startsAt: "2026-01-01T17:00:00Z",
    createdAt: "2025-12-01T10:00:00Z",
  },
  {
    club: ids.clubA,
    creator: ids.late,
    text: "Hos Mads",
    startsAt: "2026-02-01T17:00:00Z",
    createdAt: "2026-01-15T10:00:00Z",
  },
  {
    club: ids.clubA,
    creator: ids.late,
    text: "Hos Mads",
    startsAt: "2026-03-01T17:00:00Z",
    createdAt: "2026-02-15T10:00:00Z",
  },
  {
    club: ids.clubA,
    creator: ids.late,
    text: " hos \u00a0MADS ",
    startsAt: "2026-04-01T17:00:00Z",
    createdAt: "2026-03-15T10:00:00Z",
  },
  // A street address keeps "Åbn i kort".
  {
    club: ids.clubA,
    creator: ids.late,
    text: "Søndergade 12, Tilst",
    startsAt: "2026-05-01T17:00:00Z",
    createdAt: "2026-04-15T10:00:00Z",
  },
  // Æ/Ø fold (C.UTF-8); one use each, so the most recent spelling wins.
  {
    club: ids.clubA,
    creator: ids.late,
    text: "Ærø",
    startsAt: "2026-06-01T17:00:00Z",
    createdAt: "2026-05-15T10:00:00Z",
  },
  {
    club: ids.clubA,
    creator: ids.late,
    text: "ÆRØ",
    startsAt: "2026-07-01T17:00:00Z",
    createdAt: "2026-06-15T10:00:00Z",
  },
  {
    club: ids.clubA,
    creator: ids.early,
    text: LONG_TEXT,
    startsAt: "2026-08-01T17:00:00Z",
    createdAt: "2026-07-15T10:00:00Z",
  },
  // Club B: its own "Hos Mads"; a tie (same uses, same date) goes to the
  // alphabetically first spelling; NFC makes "e + ◌\u0301" and "é" the same place.
  {
    club: ids.clubB,
    creator: ids.late,
    text: "Hos Mads",
    startsAt: "2026-01-10T17:00:00Z",
    createdAt: "2026-01-01T10:00:00Z",
  },
  {
    club: ids.clubB,
    creator: ids.late,
    text: "bodega",
    startsAt: "2026-02-10T17:00:00Z",
    createdAt: "2026-02-01T10:00:00Z",
  },
  {
    club: ids.clubB,
    creator: ids.early,
    text: "Bodega",
    startsAt: "2026-02-10T17:00:00Z",
    createdAt: "2026-02-01T11:00:00Z",
  },
  {
    club: ids.clubB,
    creator: ids.late,
    text: "Cafe\u0301 Noir",
    startsAt: "2026-03-10T17:00:00Z",
    createdAt: "2026-03-01T10:00:00Z",
  },
  {
    club: ids.clubB,
    creator: ids.early,
    text: "Café\tNoir",
    startsAt: "2026-04-10T17:00:00Z",
    createdAt: "2026-04-01T10:00:00Z",
  },
  // Club C: only whitespace (the round-2 CHECK's btrim lets NBSP through).
  {
    club: ids.clubC,
    creator: ids.early,
    text: NBSP_ONLY,
    startsAt: "2026-01-20T17:00:00Z",
    createdAt: "2026-01-01T10:00:00Z",
  },
];

type PlaceRow = {
  id: string;
  club_id: string;
  name: string;
  name_key: string;
  address: string | null;
  description: string | null;
  created_by_id: string;
  created_at: Date;
  archived_at: Date | null;
};

let places: PlaceRow[] = [];

function placesOf(clubId: string): PlaceRow[] {
  return places.filter((place) => place.club_id === clubId);
}

function placeNamed(clubId: string, name: string): PlaceRow {
  const place = placesOf(clubId).find((row) => row.name === name);
  if (!place) throw new Error(`Intet sted "${name}" i klubben.`);
  return place;
}

beforeAll(async () => {
  expect(round3Index, "round-3-migrationen findes").toBeGreaterThan(0);
  await dropScratch();
  await withClient(maintenanceUrl, (client) =>
    client.query(
      `CREATE DATABASE "${SCRATCH_DB}" TEMPLATE template0 ENCODING 'UTF8' ` +
        `LC_COLLATE 'C.UTF-8' LC_CTYPE 'C.UTF-8'`,
    ),
  );

  await withClient(scratchUrl, async (client) => {
    for (const dir of dirs.slice(0, round3Index)) await client.query(readMigration(dir));

    await client.query(
      `INSERT INTO users (id, name, email, updated_at) VALUES
         ($1, 'Tidlig', 'tidlig@example.test', now()),
         ($2, 'Sen', 'sen@example.test', now())`,
      [ids.early, ids.late],
    );
    await client.query(
      `INSERT INTO clubs (id, name, description, updated_at) VALUES
         ($1, 'Klub A', '   ', now()),
         ($2, 'Klub B', '  Fredagsøl  ', now()),
         ($3, 'Klub C', NULL, now())`,
      [ids.clubA, ids.clubB, ids.clubC],
    );
    for (const event of EVENTS) {
      await client.query(
        `INSERT INTO events (id, club_id, title, starts_at, location_text, created_by_id, created_at, updated_at)
         VALUES ($1, $2, 'Smagning', $3, $4, $5, $6, $6)`,
        [randomUUID(), event.club, event.startsAt, event.text, event.creator, event.createdAt],
      );
    }

    // Exactly what `prisma migrate deploy` sends: one script, one implicit transaction.
    await client.query(round3Sql);

    places = (await client.query<PlaceRow>("SELECT * FROM places ORDER BY club_id, name")).rows;
  });
});

afterAll(async () => {
  await dropScratch();
});

describe("round-3-migrationen: fritekst → steder (D-097)", () => {
  it("laver ét sted pr. (klub, navnenøgle) med den mest brugte stavemåde", () => {
    expect(placesOf(ids.clubA).map((place) => place.name)).toEqual(
      ["Hos Mads", LONG_TEXT, "Søndergade 12, Tilst", "ÆRØ"].sort(),
    );
    expect(placesOf(ids.clubB).map((place) => place.name)).toEqual([
      "Bodega",
      "Café Noir",
      "Hos Mads",
    ]);
    expect(placesOf(ids.clubC).map((place) => place.name)).toEqual(["Ukendt sted"]);
  });

  it("gemmer navnenøglen præcis som JavaScripts placeNameKey", () => {
    expect(places.length).toBe(8);
    for (const place of places) expect(place.name_key).toBe(placeNameKey(place.name));
    expect(placeNamed(ids.clubC, "Ukendt sted").name_key).toBe("ukendtsted");
  });

  it("bevarer en tekst på 120 tegn uden at forkorte den", () => {
    expect(LONG_TEXT).toHaveLength(120);
    expect(placeNamed(ids.clubA, LONG_TEXT).name).toHaveLength(120);
  });

  it("sætter adressen, når navnet indeholder et tal", () => {
    expect(placeNamed(ids.clubA, "Søndergade 12, Tilst").address).toBe("Søndergade 12, Tilst");
    expect(placeNamed(ids.clubA, "Hos Mads").address).toBeNull();
    expect(placeNamed(ids.clubC, "Ukendt sted").address).toBeNull();
  });

  it("giver hver klub sit eget sted, også ved samme navn", () => {
    const a = placeNamed(ids.clubA, "Hos Mads");
    const b = placeNamed(ids.clubB, "Hos Mads");
    expect(a.id).not.toBe(b.id);
    expect(a.name_key).toBe(b.name_key);
  });

  it("tager opretter og oprettelsestid fra klubbens tidligste event med navnet", () => {
    const hosMads = placeNamed(ids.clubA, "Hos Mads");
    expect(hosMads.created_by_id).toBe(ids.early);
    expect(hosMads.created_at.toISOString()).toBe("2025-12-01T10:00:00.000Z");
  });

  it("laver ingen ejere, ingen beskrivelse og intet arkiv", async () => {
    expect(places.every((place) => place.description === null)).toBe(true);
    expect(places.every((place) => place.archived_at === null)).toBe(true);
    const owners = await withClient(scratchUrl, (client) =>
      client.query("SELECT count(*)::int AS n FROM place_owners"),
    );
    expect(owners.rows[0]).toEqual({ n: 0 });
  });

  it("knytter hvert event til et sted i egen klub med opretteren som eneste vært", async () => {
    const rows = await withClient(
      scratchUrl,
      async (client) =>
        (
          await client.query<{
            location_text: string;
            club_id: string;
            place_club_id: string;
            place_key: string;
            created_by_id: string;
            hosts: string[];
          }>(
            `SELECT e.location_text, e.club_id, p.club_id AS place_club_id, p.name_key AS place_key,
                  e.created_by_id,
                  ARRAY(SELECT h.user_id FROM event_hosts h WHERE h.event_id = e.id) AS hosts
           FROM events e JOIN places p ON p.id = e.place_id`,
          )
        ).rows,
    );
    expect(rows).toHaveLength(EVENTS.length);
    for (const row of rows) {
      expect(row.place_club_id).toBe(row.club_id);
      expect(row.place_key).toBe(placeNameKey(row.location_text) || "ukendtsted");
      expect(row.hosts).toEqual([row.created_by_id]);
    }
  });

  it("gør place_id påkrævet og beholder location_text som valgfri", async () => {
    const columns = await withClient(
      scratchUrl,
      async (client) =>
        (
          await client.query<{ column_name: string; is_nullable: string }>(
            `SELECT column_name, is_nullable FROM information_schema.columns
           WHERE table_name = 'events' AND column_name IN ('place_id', 'location_text')
           ORDER BY column_name`,
          )
        ).rows,
    );
    expect(columns).toEqual([
      { column_name: "location_text", is_nullable: "YES" },
      { column_name: "place_id", is_nullable: "NO" },
    ]);
  });

  it("gør tomme klubbeskrivelser til NULL og trimmer resten", async () => {
    const rows = await withClient(
      scratchUrl,
      async (client) =>
        (
          await client.query<{ id: string; description: string | null }>(
            "SELECT id, description FROM clubs",
          )
        ).rows,
    );
    const byId = new Map(rows.map((row) => [row.id, row.description]));
    expect(byId.get(ids.clubA)).toBeNull();
    expect(byId.get(ids.clubB)).toBe("Fredagsøl");
  });

  it("opretter de forventede constraints og indexes", async () => {
    const names = await withClient(scratchUrl, async (client) =>
      (
        await client.query<{ name: string }>(
          `SELECT conname AS name FROM pg_constraint
           WHERE conname ~ '^(places_|place_owners_|event_hosts_|events_place_id|users_nickname|clubs_description)'
           UNION SELECT indexname FROM pg_indexes
           WHERE indexname ~ '^(places_|place_owners_|event_hosts_|events_place_id)'
           ORDER BY 1`,
        )
      ).rows.map((row) => row.name),
    );
    expect(names).toEqual(
      [
        "clubs_description_length_check",
        "event_hosts_event_id_fkey",
        "event_hosts_pkey",
        "event_hosts_user_id_fkey",
        "event_hosts_user_id_idx",
        "events_place_id_club_id_fkey",
        "events_place_id_idx",
        "place_owners_pkey",
        "place_owners_place_id_club_id_fkey",
        "place_owners_user_id_club_id_fkey",
        "place_owners_user_id_club_id_idx",
        "place_owners_user_id_fkey",
        "places_address_length_check",
        "places_club_id_fkey",
        "places_club_id_idx",
        "places_club_id_name_key_active_key",
        "places_created_by_id_fkey",
        "places_description_length_check",
        "places_id_club_id_key",
        "places_name_key_not_empty_check",
        "places_name_length_check",
        "places_pkey",
        "users_nickname_length_check",
      ].sort(),
    );
  });
});

describe("navnenøglen i SQL = placeNameKey i JavaScript", () => {
  it("bruger samme whitespace-klasse som JavaScripts \\s for hele BMP", async () => {
    const whitespaceClass = migrationWhitespaceClass();
    const sqlMatches = await withClient(scratchUrl, async (client) =>
      (
        await client.query<{ cp: number }>(
          `SELECT cp FROM generate_series(1, 65533) cp
           WHERE (cp < 55296 OR cp > 57343) AND chr(cp) ~ $1 ORDER BY cp`,
          [whitespaceClass],
        )
      ).rows.map((row) => row.cp),
    );
    const jsMatches: number[] = [];
    for (let cp = 1; cp <= 65533; cp += 1) {
      if (cp >= 0xd800 && cp <= 0xdfff) continue;
      if (/\s/.test(String.fromCharCode(cp))) jsMatches.push(cp);
    }
    expect(sqlMatches).toEqual(jsMatches);
  });

  it("giver samme nøgle for de svære tilfælde", async () => {
    const whitespaceClass = migrationWhitespaceClass();
    const samples = [
      "Hos Mads",
      " hos\u00a0\u00a0MADS\n",
      "Ærø Ø Å",
      "Cafe\u0301\u3000Noir",
      "Søndergade 12,\u2009Tilst",
      "\ufeffBOM foran",
      "Tab\tog\u2028linjeskift",
    ];
    const sqlKeys = await withClient(scratchUrl, async (client) => {
      const keys: (string | undefined)[] = [];
      for (const text of samples) {
        const { rows } = await client.query<{ key: string }>(
          `SELECT regexp_replace(lower(normalize($1::text, NFC)), $2, '', 'g') AS key`,
          [text, whitespaceClass],
        );
        keys.push(rows[0]?.key);
      }
      return keys;
    });
    expect(sqlKeys).toEqual(samples.map(placeNameKey));
  });
});
