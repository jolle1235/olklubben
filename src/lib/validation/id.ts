import { z } from "zod";

import { isValidId } from "@/lib/ids";

/**
 * An id from a URL, a form or a Server Action argument (untrusted). Server
 * Actions turn a failed parse into notFound(), like a resource from another
 * club (SPEC §4.4, E22).
 *
 * Client-safe: no server-only imports.
 */
export const idSchema = z.string().refine(isValidId, "Ugyldigt id.");
