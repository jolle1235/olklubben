import { describe, expect, it } from "vitest";

import {
  DEFAULT_FEEDBACK_LIST_PARAMS,
  feedbackListSearch,
  parseFeedbackListParams,
} from "./list-params";

describe("parseFeedbackListParams (SPEC §9.9)", () => {
  it("defaults to all types, open reports, everyone's, most votes first", () => {
    expect(parseFeedbackListParams({})).toEqual({
      type: "all",
      status: "open",
      mine: false,
      sort: "votes",
    });
    expect(DEFAULT_FEEDBACK_LIST_PARAMS).toEqual(parseFeedbackListParams({}));
  });

  it("reads every known value", () => {
    expect(
      parseFeedbackListParams({ type: "bug", status: "closed", mine: "1", sort: "newest" }),
    ).toEqual({ type: "bug", status: "closed", mine: true, sort: "newest" });
    expect(parseFeedbackListParams({ type: "feature", status: "all" })).toMatchObject({
      type: "feature",
      status: "all",
    });
  });

  it("falls back to the default for unknown or odd values", () => {
    expect(
      parseFeedbackListParams({ type: "BUG", status: "lukket", mine: "true", sort: "votes " }),
    ).toEqual(DEFAULT_FEEDBACK_LIST_PARAMS);
    expect(parseFeedbackListParams({ type: ["feature", "bug"], mine: ["1", "0"] })).toMatchObject({
      type: "feature",
      mine: true,
    });
    expect(parseFeedbackListParams({ type: "__proto__", sort: "constructor" })).toEqual(
      DEFAULT_FEEDBACK_LIST_PARAMS,
    );
  });
});

describe("feedbackListSearch", () => {
  it("leaves the defaults out", () => {
    expect(feedbackListSearch()).toBe("");
    expect(feedbackListSearch(DEFAULT_FEEDBACK_LIST_PARAMS)).toBe("");
    expect(feedbackListSearch({ type: "all", mine: false })).toBe("");
  });

  it("writes the choices that differ", () => {
    expect(feedbackListSearch({ type: "bug" })).toBe("?type=bug");
    expect(
      feedbackListSearch({ type: "feature", status: "closed", mine: true, sort: "newest" }),
    ).toBe("?type=feature&status=closed&mine=1&sort=newest");
  });

  it("round-trips through the parser", () => {
    const params = { type: "bug", status: "all", mine: true, sort: "newest" } as const;
    const query = Object.fromEntries(new URLSearchParams(feedbackListSearch(params)));
    expect(parseFeedbackListParams(query)).toEqual(params);
  });
});
