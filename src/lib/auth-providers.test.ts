import { describe, expect, it } from "vitest";

import { EXTERNAL_PROVIDERS } from "./auth-providers";

describe("EXTERNAL_PROVIDERS (D-179)", () => {
  it('calls Auth0 Universal Login "Google" in the UI', () => {
    expect(EXTERNAL_PROVIDERS.auth0.signIn).toBe("Fortsæt med Google");
  });
});
