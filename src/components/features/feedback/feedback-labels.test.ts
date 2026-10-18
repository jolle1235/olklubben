import { describe, expect, it } from "vitest";

import {
  DEFAULT_FEEDBACK_LIST_PARAMS,
  parseFeedbackListParams,
  type FeedbackListParams,
} from "@/server/domain/feedback/list-params";

import {
  FEEDBACK_DESCRIPTION_PLACEHOLDERS,
  feedbackEmptyState,
  feedbackFilterGroups,
  feedbackVoteLabel,
  formatViewportWidth,
  voteNoun,
} from "./feedback-labels";

const params = (overrides: Partial<FeedbackListParams> = {}): FeedbackListParams => ({
  ...DEFAULT_FEEDBACK_LIST_PARAMS,
  ...overrides,
});

describe("feedbackFilterGroups", () => {
  it("links every choice from the default list, defaults left out", () => {
    const groups = feedbackFilterGroups(params());
    expect(groups.type.map(({ label, href, current }) => [label, href, current])).toEqual([
      ["Alle", "/feedback", true],
      ["🐞 Fejl", "/feedback?type=bug", false],
      ["💡 Ønsker", "/feedback?type=feature", false],
    ]);
    expect(groups.status.map(({ label, href, current }) => [label, href, current])).toEqual([
      ["Åbne", "/feedback", true],
      ["Lukkede", "/feedback?status=closed", false],
      ["Alle", "/feedback?status=all", false],
    ]);
    expect(groups.mine).toMatchObject({ href: "/feedback?mine=1", current: false });
    expect(groups.sort.map(({ label, href, current }) => [label, href, current])).toEqual([
      ["Flest stemmer", "/feedback", true],
      ["Nyeste", "/feedback?sort=newest", false],
    ]);
  });

  it("keeps the other choices in every link", () => {
    const groups = feedbackFilterGroups(
      params({ type: "bug", status: "closed", mine: true, sort: "newest" }),
    );
    expect(groups.type[2]?.href).toBe("/feedback?type=feature&status=closed&mine=1&sort=newest");
    expect(groups.status[0]?.href).toBe("/feedback?type=bug&mine=1&sort=newest");
    expect(groups.sort[0]?.href).toBe("/feedback?type=bug&status=closed&mine=1");
    expect(groups.type.find((chip) => chip.current)?.label).toBe("🐞 Fejl");
    expect(groups.status.find((chip) => chip.current)?.label).toBe("Lukkede");
  });

  it("turns “Mine rapporter” off again while it is on", () => {
    expect(feedbackFilterGroups(params({ mine: true })).mine).toMatchObject({
      href: "/feedback",
      current: true,
    });
  });

  it("round-trips: every link opens a list where that chip is the current one", () => {
    const start = params({ type: "feature", sort: "newest" });
    const groups = feedbackFilterGroups(start);
    const chips = [...groups.type, ...groups.status, ...groups.sort];
    for (const chip of chips) {
      const search = new URL(chip.href, "http://x").searchParams;
      const after = feedbackFilterGroups(parseFeedbackListParams(Object.fromEntries(search)));
      const same = [...after.type, ...after.status, ...after.sort].find((c) => c.key === chip.key);
      expect(same?.current, chip.key).toBe(true);
    }
    const closed = new URL(groups.status[1]?.href ?? "", "http://x").searchParams;
    expect(parseFeedbackListParams(Object.fromEntries(closed))).toEqual(
      params({ type: "feature", status: "closed", sort: "newest" }),
    );
  });
});

describe("feedbackEmptyState", () => {
  it("cheers when nothing is open", () => {
    expect(feedbackEmptyState(params(), { hasOwnReports: false }).title).toBe(
      "Ingen åbne rapporter. Skål!",
    );
    expect(feedbackEmptyState(params({ type: "bug" }), { hasOwnReports: false }).title).toBe(
      "Ingen åbne fejl. Skål!",
    );
    expect(feedbackEmptyState(params({ type: "feature" }), { hasOwnReports: false }).title).toBe(
      "Ingen åbne ønsker. Skål!",
    );
  });

  it("names the closed and the full list", () => {
    expect(feedbackEmptyState(params({ status: "closed" }), { hasOwnReports: true }).title).toBe(
      "Ingen lukkede rapporter endnu.",
    );
    expect(
      feedbackEmptyState(params({ status: "all", type: "bug" }), { hasOwnReports: true }).title,
    ).toBe("Ingen fejl endnu.");
  });

  it("tells a viewer without reports that they have sent none", () => {
    const state = feedbackEmptyState(params({ mine: true }), { hasOwnReports: false });
    expect(state.title).toBe("Du har ikke sendt nogen rapporter endnu.");
    expect(state.allMineHref).toBeUndefined();
  });

  it("points a viewer with other reports to all of them", () => {
    const state = feedbackEmptyState(params({ mine: true, type: "bug" }), {
      hasOwnReports: true,
    });
    expect(state.title).toBe("Du har ingen åbne fejl her.");
    expect(state.allMineHref).toBe("/feedback?status=all&mine=1");
    expect(
      feedbackEmptyState(params({ mine: true, status: "all" }), { hasOwnReports: true }).title,
    ).toBe("Du har ingen rapporter her.");
  });
});

describe("feedback texts", () => {
  it("says what the 👍 button does", () => {
    expect(feedbackVoteLabel("BUG", false)).toBe("👍 Jeg har også det problem");
    expect(feedbackVoteLabel("FEATURE", false)).toBe("👍 Det vil jeg også gerne have");
    expect(feedbackVoteLabel("BUG", true)).toBe("Fjern min 👍");
    expect(feedbackVoteLabel("FEATURE", true)).toBe("Fjern min 👍");
  });

  it("counts votes in Danish", () => {
    expect(voteNoun(1)).toBe("stemme");
    expect(voteNoun(2)).toBe("stemmer");
  });

  it("guides the description by type", () => {
    expect(FEEDBACK_DESCRIPTION_PLACEHOLDERS.BUG).toMatch(/gentage fejlen/);
    expect(FEEDBACK_DESCRIPTION_PLACEHOLDERS.FEATURE).toMatch(/hvorfor/);
  });

  it("writes the screen width with a no-break space", () => {
    expect(formatViewportWidth(390)).toBe("390 px");
    expect(formatViewportWidth(null)).toBeNull();
  });
});
