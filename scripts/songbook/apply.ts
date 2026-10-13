import type { Prisma } from "../../src/generated/prisma/client";

import type { ExistingSong, PlanItem } from "./plan";

/**
 * The importer's only writes, inside the CLI's one transaction:
 *
 *   * NY / NY? (write) → createMany with plain scalars, createdBy = --user,
 *     sourceKey and importHash set;
 *   * OPDATERES → updateMany guarded by the updatedAt the plan saw. A count
 *     of 0 means the song changed meanwhile: everything is rolled back.
 *
 * Nothing is ever deleted. Every query is scoped by clubId (§4.4).
 */

type Tx = Prisma.TransactionClient;

export class ConcurrentEditError extends Error {
  constructor(title: string) {
    super(`Sangen «${title}» blev ændret imens – kør igen.`);
    this.name = "ConcurrentEditError";
  }
}

/** The club's songs as planSongImport needs them. */
export async function readClubSongs(tx: Tx, clubId: string): Promise<ExistingSong[]> {
  return tx.song.findMany({
    where: { clubId },
    select: {
      id: true,
      title: true,
      titleKey: true,
      artist: true,
      melody: true,
      body: true,
      sourceKey: true,
      importHash: true,
      updatedAt: true,
    },
    orderBy: { id: "asc" },
  });
}

export async function applyImportPlan(
  tx: Tx,
  plan: readonly PlanItem[],
  { clubId, userId }: { clubId: string; userId: string },
): Promise<{ created: number; updated: number }> {
  const creates = plan.filter((i) => i.write && (i.status === "NY" || i.status === "NY?"));
  let created = 0;
  if (creates.length > 0) {
    const result = await tx.song.createMany({
      data: creates.flatMap(({ song }) =>
        song
          ? [
              {
                clubId,
                createdById: userId,
                title: song.title,
                titleKey: song.titleKey,
                artist: song.artist,
                melody: song.melody,
                body: song.body,
                sourceKey: song.sourceKey,
                importHash: song.hash,
              },
            ]
          : [],
      ),
    });
    created = result.count;
  }

  let updated = 0;
  for (const { status, write, song, existing } of plan) {
    if (status !== "OPDATERES" || !write || !song || !existing) continue;
    const { count } = await tx.song.updateMany({
      where: { id: existing.id, clubId, updatedAt: existing.updatedAt },
      data: {
        title: song.title,
        titleKey: song.titleKey,
        artist: song.artist,
        melody: song.melody,
        body: song.body,
        importHash: song.hash,
      },
    });
    if (count !== 1) throw new ConcurrentEditError(existing.title);
    updated += 1;
  }
  return { created, updated };
}
