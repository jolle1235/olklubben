import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/server/auth/auth";

/** Better Auth's HTTP endpoints (/api/auth/*), used by authClient and Google's callback. */
export const { GET, POST } = toNextJsHandler(auth);
