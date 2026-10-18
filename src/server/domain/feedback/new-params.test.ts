import { describe, expect, it } from "vitest";

import { parseNewFeedbackParams } from "./new-params";

const CLUB_ID = "019a0c1e-7d2b-7c3a-9f00-1234567890ab";

describe("parseNewFeedbackParams", () => {
  it("defaults to a bug without a page", () => {
    expect(parseNewFeedbackParams({})).toEqual({ type: "BUG", page: "" });
  });

  it("reads the type in any case", () => {
    expect(parseNewFeedbackParams({ type: "feature" }).type).toBe("FEATURE");
    expect(parseNewFeedbackParams({ type: "FEATURE" }).type).toBe("FEATURE");
    expect(parseNewFeedbackParams({ type: " Feature " }).type).toBe("FEATURE");
    expect(parseNewFeedbackParams({ type: "bug" }).type).toBe("BUG");
    expect(parseNewFeedbackParams({ type: "BUG" }).type).toBe("BUG");
  });

  it("falls back to a bug for unknown, repeated-garbage or overlong types", () => {
    expect(parseNewFeedbackParams({ type: "idea" }).type).toBe("BUG");
    expect(parseNewFeedbackParams({ type: "" }).type).toBe("BUG");
    expect(parseNewFeedbackParams({ type: "feature".padEnd(500, "x") }).type).toBe("BUG");
    expect(parseNewFeedbackParams({ type: "feat\u0000ure" }).type).toBe("FEATURE");
    expect(parseNewFeedbackParams({ type: ["feature", "bug"] }).type).toBe("FEATURE");
  });

  it("removes the club id, query and hash from the page (E26, D-143)", () => {
    expect(parseNewFeedbackParams({ page: `/c/${CLUB_ID}/calendar` }).page).toBe("/calendar");
    expect(parseNewFeedbackParams({ page: `/c/${CLUB_ID}/beers?q=pilsner#top` }).page).toBe(
      "/beers",
    );
    expect(parseNewFeedbackParams({ page: "/join/K7XMQ2PA" }).page).toBe("/join");
    expect(parseNewFeedbackParams({ page: [`/c/${CLUB_ID}/songs`, "/x"] }).page).toBe("/songs");
  });

  it("drops a page that is not a path", () => {
    expect(parseNewFeedbackParams({ page: "https://evil.example/x" }).page).toBe("");
    expect(parseNewFeedbackParams({ page: "//evil.example" }).page).toBe("");
    expect(parseNewFeedbackParams({ page: "calendar" }).page).toBe("");
    expect(parseNewFeedbackParams({ page: "/".padEnd(5000, "a") }).page).toBe("");
  });
});
