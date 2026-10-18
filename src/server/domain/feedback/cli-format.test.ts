import { describe, expect, it } from "vitest";

import {
  feedbackSummary,
  formatFeedbackBlock,
  formatFeedbackList,
  terminalSafe,
  type FeedbackCliItem,
} from "./cli-format";

const ID = "0199a000-0000-7000-8000-00000000f001";

function item(overrides: Partial<FeedbackCliItem> = {}): FeedbackCliItem {
  return {
    id: ID,
    type: "BUG",
    status: "NEW",
    title: "Kalenderen viser forkert dato",
    description: "Hvad skete der?\nDen viste fredag.",
    pagePath: "/calendar",
    adminResponse: null,
    authorName: "Kaptajnen",
    upvotes: 4,
    // 23:30 UTC on 15 October = 16 October in Copenhagen (summer time).
    createdAt: new Date("2026-10-15T23:30:00Z"),
    userAgent: "Mozilla/5.0 (iPhone)",
    viewportWidth: 390,
    ...overrides,
  };
}

describe("formatFeedbackBlock (scripts/list-feedback.ts, D-146)", () => {
  it("prints the header, title, page and description", () => {
    expect(formatFeedbackBlock(item())).toBe(
      [
        `[${ID}] 🐞 Fejl · Ny · 👍 4 · Kaptajnen · 2026-10-16`,
        "Kalenderen viser forkert dato",
        "Side: /calendar",
        "  Hvad skete der?",
        "  Den viste fredag.",
      ].join("\n"),
    );
  });

  it("prints a feature without a page, with the admin's answer", () => {
    const block = formatFeedbackBlock(
      item({
        type: "FEATURE",
        status: "PLANNED",
        pagePath: null,
        adminResponse: "Giver mening – planlagt.",
        authorName: "Tidligere bruger",
        upvotes: 1,
        userAgent: null,
        viewportWidth: null,
      }),
    );
    expect(block.split("\n")[0]).toBe(
      `[${ID}] 💡 Idé / ønske · Planlagt · 👍 1 · Tidligere bruger · 2026-10-16`,
    );
    expect(block).not.toContain("Side:");
    expect(block).toContain("\nSvar: Giver mening – planlagt.");
    expect(block).not.toContain("Teknisk info");
  });

  it("shows the technical info only when asked", () => {
    expect(formatFeedbackBlock(item())).not.toContain("Mozilla");
    expect(formatFeedbackBlock(item(), { withTech: true })).toContain(
      "\nTeknisk info: Mozilla/5.0 (iPhone) · 390 px",
    );
    expect(
      formatFeedbackBlock(item({ userAgent: null, viewportWidth: null }), { withTech: true }),
    ).toContain("\nTeknisk info: –");
  });

  it("never sends control characters (escape sequences) to the terminal", () => {
    const block = formatFeedbackBlock(
      item({
        title: "Ond\u001b[2J titel",
        description: "Linje 1\u001b]0;hack\u0007\nLinje\t2",
        authorName: "Bjørn\u009b",
      }),
    );
    for (const control of ["\u001b", "\u0007", "\u009b"]) expect(block).not.toContain(control);
    expect(block).toContain("Ond�[2J titel");
    expect(block).toContain("  Linje\t2");
  });
});

describe("formatFeedbackList", () => {
  it("says so when there is nothing open", () => {
    expect(formatFeedbackList([])).toBe("Ingen åbne rapporter.");
  });

  it("separates the blocks with a blank line and ends with the count", () => {
    const text = formatFeedbackList([item(), item({ id: "x", title: "Anden" })]);
    expect(text.split("\n\n")).toHaveLength(3);
    expect(text.endsWith("\n\n2 åbne rapporter")).toBe(true);
  });

  it("counts in Danish", () => {
    expect(feedbackSummary(0)).toBe("Ingen åbne rapporter.");
    expect(feedbackSummary(1)).toBe("1 åben rapport");
    expect(feedbackSummary(12)).toBe("12 åbne rapporter");
  });
});

describe("terminalSafe", () => {
  it("keeps text, line breaks and tabs, replaces other controls", () => {
    expect(terminalSafe("Æble\nøl\tå")).toBe("Æble\nøl\tå");
    expect(terminalSafe("a\u0000b\u007fc\rd")).toBe("a�b�c�d");
  });
});
