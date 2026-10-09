/**
 * Every id in the database is a UUID string (Prisma `@default(uuid(7))`, see
 * prisma/schema.prisma). Ids from the URL or a form are untrusted input:
 * check them with isValidId() first and render notFound() when they fail,
 * so a malformed id gives 404, never a 500 (SPEC §4.4, E22).
 *
 * Client-safe: no server-only imports.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}
