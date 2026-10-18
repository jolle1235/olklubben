import { describe, expect, it } from "vitest";

import {
  CLOSED_FEEDBACK_STATUSES,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_STATUSES,
  FEEDBACK_TYPE_ICONS,
  FEEDBACK_TYPE_LABELS,
  FEEDBACK_TYPES,
  isFeedbackStatus,
  isFeedbackType,
  isOpenFeedbackStatus,
  OPEN_FEEDBACK_STATUSES,
  statusesForFilter,
} from "./status";

describe("feedback types and statuses (SPEC §9.9)", () => {
  it("has the Danish labels and icons from the spec", () => {
    expect(FEEDBACK_TYPES).toEqual(["BUG", "FEATURE"]);
    expect(FEEDBACK_TYPE_LABELS).toEqual({ BUG: "Fejl", FEATURE: "Idé / ønske" });
    expect(FEEDBACK_TYPE_ICONS).toEqual({ BUG: "🐞", FEATURE: "💡" });
    expect(FEEDBACK_STATUS_LABELS).toEqual({
      NEW: "Ny",
      PLANNED: "Planlagt",
      IN_PROGRESS: "I gang",
      DONE: "Færdig ✓",
      WONT_DO: "Afvist",
      DUPLICATE: "Dublet",
    });
  });

  it("splits every status into exactly one group, DUPLICATE as closed (D-144)", () => {
    expect([...OPEN_FEEDBACK_STATUSES, ...CLOSED_FEEDBACK_STATUSES].sort()).toEqual(
      [...FEEDBACK_STATUSES].sort(),
    );
    expect(CLOSED_FEEDBACK_STATUSES).toContain("DUPLICATE");
    for (const status of FEEDBACK_STATUSES) {
      expect(isOpenFeedbackStatus(status)).toBe(
        (OPEN_FEEDBACK_STATUSES as readonly string[]).includes(status),
      );
    }
  });

  it("maps the list filter to statuses", () => {
    expect(statusesForFilter("open")).toEqual(["NEW", "PLANNED", "IN_PROGRESS"]);
    expect(statusesForFilter("closed")).toEqual(["DONE", "WONT_DO", "DUPLICATE"]);
    expect(statusesForFilter("all")).toEqual([...FEEDBACK_STATUSES]);
    // A copy: callers may not change the constants.
    statusesForFilter("open").push("DONE");
    expect(OPEN_FEEDBACK_STATUSES).toHaveLength(3);
  });

  it("recognises the enum values and nothing else", () => {
    expect(isFeedbackType("BUG")).toBe(true);
    expect(isFeedbackType("bug")).toBe(false);
    expect(isFeedbackType(null)).toBe(false);
    expect(isFeedbackStatus("WONT_DO")).toBe(true);
    expect(isFeedbackStatus("CLOSED")).toBe(false);
    expect(isFeedbackStatus(3)).toBe(false);
  });
});
