import { beforeAll, describe, expect, it, vi } from "vitest";

import { ACTION_ERROR_CODES } from "@/lib/action-result";
import { importSongsAction, readSongPdfAction } from "@/server/actions/song-import";
import { db } from "@/server/db";
import { contentHash } from "@/server/domain/songs/import-hash";

import { buildPdf } from "../support/pdf";

import {
  addMember,
  createClub,
  createUser,
  expectNotFound,
  setActor,
  type TestUser,
} from "./helpers";

/**
 * The PDF import's Server Actions against the real database (SPEC §9.6,
 * D-156): admins only, a member is refused and a non-member gets a 404 (§4.4);
 * a draft's status in the club; an import that skips what the club already
 * has and keeps the provenance. Made-up songs only (SPEC §19.1 rule 10).
 */
vi.mock("next/headers", async () => (await import("./helpers")).nextHeadersModule);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let admin: TestUser;
let member: TestUser;
let outsider: TestUser;
let clubId: string;
let otherClubId: string;

const song = (title: string, file: string) => ({
  title,
  artist: "",
  melody: "",
  body: "Humle og malt\nog skummet stiger op",
  sourceKey: `pdf:${file}`,
  importHash: null,
});

function pdfForm(name: string, title: string): FormData {
  const form = new FormData();
  const bytes = buildPdf([
    { text: title, x: 72, y: 720, size: 20 },
    { text: "Humle i haven hele dagen", x: 72, y: 690, size: 11 },
  ]);
  form.set("file", new File([bytes], name, { type: "application/pdf" }));
  return form;
}

beforeAll(async () => {
  admin = await createUser("Import Admin");
  member = await createUser("Import Medlem");
  outsider = await createUser("Import Udefra");
  clubId = await createClub(admin, "Importklubben");
  otherClubId = await createClub(outsider, "Den anden klub");
  await addMember(clubId, member);
});

describe("readSongPdfAction", () => {
  it("reads a PDF into a draft with its status in the club", async () => {
    setActor(admin);
    const result = await readSongPdfAction(clubId, pdfForm("gaerens-sang.pdf", "GÆRENS SANG"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      kind: "text",
      sourceKey: "pdf:gaerens-sang.pdf",
      title: "Gærens sang",
      status: "new",
      existing: null,
      fieldErrors: null,
    });
    expect(result.data.importHash).toBe(
      contentHash({ title: "Gærens sang", artist: null, melody: null, body: result.data.body }),
    );
  });

  it("refuses a member, a file that is not a PDF, and 404s a non-member", async () => {
    setActor(member);
    const refused = await readSongPdfAction(clubId, pdfForm("a.pdf", "A"));
    expect(refused).toMatchObject({ ok: false, error: { code: ACTION_ERROR_CODES.FORBIDDEN } });

    setActor(admin);
    const form = new FormData();
    form.set("file", new File(["hej"], "hej.pdf", { type: "application/pdf" }));
    expect(await readSongPdfAction(clubId, form)).toMatchObject({
      ok: false,
      error: { message: "Filen er ikke en PDF." },
    });

    setActor(outsider);
    await expectNotFound(readSongPdfAction(clubId, pdfForm("a.pdf", "A")));
  });
});

describe("importSongsAction", () => {
  it("creates the songs with their provenance and skips what the club already has", async () => {
    setActor(admin);
    const first = await importSongsAction(clubId, [
      song("Skummets vise", "skum.pdf"),
      { ...song("Bryggerens bøn", "bon.pdf"), importHash: "a".repeat(64) },
    ]);
    expect(first).toEqual({ ok: true, data: { created: 2, skipped: [] } });
    const stored = await db.song.findFirst({ where: { clubId, title: "Bryggerens bøn" } });
    expect(stored).toMatchObject({ sourceKey: "pdf:bon.pdf", importHash: "a".repeat(64) });

    const again = await importSongsAction(clubId, [
      song("Skummets vise 2", "skum.pdf"),
      song("SKUMMETS  VISE", "andet.pdf"),
      song("Ny sang", "ny.pdf"),
      song("Ny sang", "ny-igen.pdf"),
    ]);
    expect(again).toEqual({
      ok: true,
      data: {
        created: 1,
        skipped: [
          { title: "Skummets vise 2", reason: "imported" },
          { title: "SKUMMETS VISE", reason: "title-taken" },
          { title: "Ny sang", reason: "duplicate" },
        ],
      },
    });

    // The same file in another club is that club's own business (§4.4).
    setActor(outsider);
    expect(await importSongsAction(otherClubId, [song("Skummets vise", "skum.pdf")])).toEqual({
      ok: true,
      data: { created: 1, skipped: [] },
    });
  });

  it("refuses a member and validates every song", async () => {
    setActor(member);
    expect(await importSongsAction(clubId, [song("Medlemmets sang", "m.pdf")])).toMatchObject({
      ok: false,
      error: { code: ACTION_ERROR_CODES.FORBIDDEN },
    });
    setActor(admin);
    expect(
      await importSongsAction(clubId, [{ ...song("", "tom.pdf"), sourceKey: "andet:x" }]),
    ).toMatchObject({ ok: false, error: { code: ACTION_ERROR_CODES.VALIDATION } });
    expect(await db.song.count({ where: { clubId, title: "Medlemmets sang" } })).toBe(0);
  });
});
