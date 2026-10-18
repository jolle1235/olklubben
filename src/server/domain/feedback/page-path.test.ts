import { describe, expect, it } from "vitest";

import { FEEDBACK_PAGE_PATH_MAX_LENGTH, toFeedbackPagePath } from "./page-path";

const CLUB = "019a1b2c-3d4e-7f00-8a00-1234567890ab";

describe("toFeedbackPagePath (SPEC §9.9, E26, D-143)", () => {
  it("removes the club segment from shallow and deep club paths", () => {
    expect(toFeedbackPagePath(`/c/${CLUB}/calendar`)).toBe("/calendar");
    expect(toFeedbackPagePath(`/c/${CLUB}/events/0199a000-0000-7000-8000-000000000001/edit`)).toBe(
      "/events/0199a000-0000-7000-8000-000000000001/edit",
    );
    expect(toFeedbackPagePath(`/c/${CLUB}`)).toBe("/");
    expect(toFeedbackPagePath(`/c/${CLUB}/`)).toBe("/");
    expect(toFeedbackPagePath(`/c/${CLUB}/calendar/`)).toBe("/calendar");
    expect(toFeedbackPagePath("/c")).toBe("/");
  });

  it("removes the segment even when it is not a uuid (encoded, short, upper-case C)", () => {
    expect(toFeedbackPagePath("/c/abc123/calendar")).toBe("/calendar");
    expect(toFeedbackPagePath("/c/%2e%2e/beers")).toBe("/beers");
    expect(toFeedbackPagePath(`/C/${CLUB}/beers`)).toBe("/beers");
    expect(toFeedbackPagePath("/c//abc/songs")).toBe("/songs");
  });

  it("never returns the club id", () => {
    for (const input of [
      `/c/${CLUB}`,
      `/c/${CLUB}/`,
      `/c/${CLUB}/calendar?club=1`,
      `/c/${CLUB}/polls/new#stem`,
      `//c/${CLUB}/x`,
      `/c/${CLUB}?next=/c/${CLUB}`,
    ]) {
      expect(toFeedbackPagePath(input) ?? "").not.toContain(CLUB);
    }
  });

  it("drops the query and the hash (search terms, tokens, anchors)", () => {
    expect(toFeedbackPagePath(`/c/${CLUB}/calendar?x=1#y`)).toBe("/calendar");
    expect(toFeedbackPagePath("/beers?q=westmalle&sort=name")).toBe("/beers");
    expect(toFeedbackPagePath("/reset-password?token=hemmelig")).toBe("/reset-password");
    expect(toFeedbackPagePath("/calendar#tidligere")).toBe("/calendar");
    expect(toFeedbackPagePath("/?toast=x")).toBe("/");
  });

  it("redacts invitation codes", () => {
    expect(toFeedbackPagePath("/join/ABC")).toBe("/join");
    expect(toFeedbackPagePath("/join/K7XMQ2PA/")).toBe("/join");
    expect(toFeedbackPagePath("/join")).toBe("/join");
    expect(toFeedbackPagePath("/joinx/ABC")).toBe("/joinx/ABC");
  });

  it("keeps ordinary app paths", () => {
    expect(toFeedbackPagePath("/onboarding")).toBe("/onboarding");
    expect(toFeedbackPagePath("/feedback/new")).toBe("/feedback/new");
    expect(toFeedbackPagePath("  /calendar  ")).toBe("/calendar");
    expect(toFeedbackPagePath("/")).toBe("/");
    expect(toFeedbackPagePath("/clubs//")).toBe("/clubs");
  });

  it("refuses anything that is not a path", () => {
    for (const input of [
      "//evil.com",
      "//evil.com/c/x",
      "https://x",
      "http://localhost:3002/calendar",
      "javascript:alert(1)",
      "calendar",
      "/\\evil.com",
      "/cal\\endar",
      "/cal\nendar",
      "/cal\tendar",
      "/cal\u007fendar",
      "",
      "   ",
    ]) {
      expect(toFeedbackPagePath(input)).toBeNull();
    }
  });

  it("refuses non-strings and overlong raw input", () => {
    expect(toFeedbackPagePath(null)).toBeNull();
    expect(toFeedbackPagePath(undefined)).toBeNull();
    expect(toFeedbackPagePath(42)).toBeNull();
    expect(toFeedbackPagePath(["/calendar"])).toBeNull();
    expect(toFeedbackPagePath(`/${"a".repeat(2048)}`)).toBeNull();
  });

  it("strips NUL like every other text", () => {
    expect(toFeedbackPagePath("/cal\u0000endar")).toBe("/calendar");
  });

  it("cuts long paths at 200 characters (the CHECK), without a trailing slash", () => {
    const long = toFeedbackPagePath(`/${"a".repeat(300)}`);
    expect(long).toHaveLength(FEEDBACK_PAGE_PATH_MAX_LENGTH);
    expect(long?.startsWith("/aaa")).toBe(true);
    const slashAtCut = toFeedbackPagePath(`/${"a".repeat(198)}/bbb`);
    expect(slashAtCut).toBe(`/${"a".repeat(198)}`);
  });
});
