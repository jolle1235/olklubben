"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { ok, unexpectedError, validationError, type ActionResult } from "@/lib/action-result";
import { updateProfileSchema } from "@/lib/validation/profile";
import { auth } from "@/server/auth/auth";
import { toAuthActionError } from "@/server/auth/errors";
import { requireUser } from "@/server/auth/session";
import { getUserName } from "@/server/users/queries";

/**
 * Changes the logged-in user's name (SPEC §9.8 basisprofil, D-023).
 *
 * Goes through Better Auth's updateUser, so its user update hook normalises
 * the name (cleanUserName: trimmed, inner whitespace collapsed, max 100) and
 * the session cookie is rewritten. Returns the name as stored.
 */
export async function updateProfileName(input: unknown): Promise<ActionResult<{ name: string }>> {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const user = await requireUser();

  try {
    await auth.api.updateUser({ body: { name: parsed.data.name }, headers: await headers() });
  } catch (error) {
    return toAuthActionError(error, "generic");
  }

  // updateUser does not return the normalised name, so read it back.
  const savedName = await getUserName(user.id);
  if (savedName === null) return unexpectedError();

  // The name is shown in the sidebar of every club page.
  revalidatePath("/c/[clubId]", "layout");
  return ok({ name: savedName });
}
