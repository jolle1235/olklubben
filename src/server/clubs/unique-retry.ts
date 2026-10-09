/**
 * Retry for unique-constraint collisions (Prisma P2002).
 *
 * Invitation codes are random, so a new code can (very rarely) collide with an
 * existing one (invites_code_key). Two admins regenerating the code at the same
 * time collide on invites_club_id_active_key. In both cases the transaction is
 * rolled back, and running it again with a fresh code is the right answer.
 *
 * Pure: recognises the error by its `code` (Prisma.PrismaClientKnownRequestError
 * has code "P2002"), so it can be unit-tested without a database.
 */

export const UNIQUE_RETRY_ATTEMPTS = 5;

export function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

/**
 * Runs `task` (typically a whole `db.$transaction`) and runs it again when it
 * fails with a unique-constraint error, up to `attempts` times in total. Any
 * other error, and the last collision, is rethrown.
 */
export async function retryOnUniqueViolation<T>(
  task: (attempt: number) => Promise<T>,
  attempts: number = UNIQUE_RETRY_ATTEMPTS,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await task(attempt);
    } catch (error) {
      if (attempt >= attempts || !isUniqueConstraintError(error)) throw error;
    }
  }
}
