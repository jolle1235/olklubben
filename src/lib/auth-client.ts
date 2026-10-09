import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Better Auth's browser client (React). Talks to /api/auth/* on the same
 * origin, so no URL or secret is needed here.
 *
 *   authClient.signUp.email({ name, email, password })
 *   authClient.signIn.email({ email, password })
 *   authClient.signIn.social({ provider: "google", callbackURL: "/" })
 *   authClient.requestPasswordReset({ email })
 *   authClient.resetPassword({ newPassword, token })
 *   authClient.signOut()
 *
 * Every call returns { data, error }; show getAuthErrorMessage(error, flow)
 * from src/lib/auth-errors.ts. Requests through this client are rate-limited
 * (src/server/auth/auth-rate-limit.ts).
 */
export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields({
      user: {
        lastActiveClubId: { type: "string", required: false, input: false },
      },
    }),
  ],
});
