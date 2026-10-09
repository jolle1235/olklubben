import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "@/env";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";

import { pgConfig } from "./pg-config";

/**
 * The one Prisma Client of the app (SPEC §4.2: server/db).
 *
 * Prisma 7 talks to Postgres through a driver adapter (@prisma/adapter-pg).
 * DATABASE_URL is Neon's pooled connection string in production (SPEC §4.8).
 *
 * Every connection runs with TimeZone=UTC (pgConfig, SPEC §19.4 F-012): the
 * adapter sends Date parameters as UTC without an offset, so a session in any
 * other time zone would store shifted timestamps. Neon's pooled hosts are
 * already UTC and get no startup option.
 *
 * In development the client is cached on globalThis, so hot reloads reuse the
 * connection pool instead of opening a new one per reload.
 *
 * Club isolation (SPEC §4.4): every query on club data must be scoped by
 * clubId, e.g. `where: { id, clubId }` – never by id alone.
 */
function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg(pgConfig(env.DATABASE_URL));
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "production" ? ["error"] : ["warn", "error"],
  });
}

const globalForPrisma = globalThis as typeof globalThis & {
  __olklubbenPrisma?: PrismaClient;
};

export const db: PrismaClient = globalForPrisma.__olklubbenPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__olklubbenPrisma = db;
}

/** The client passed to `db.$transaction(async (tx) => …)`. */
export type TransactionClient = Prisma.TransactionClient;
