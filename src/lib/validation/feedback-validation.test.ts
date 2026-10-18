import { describe, expect, it } from "vitest";

import {
  cleanFeedbackDescription,
  FEEDBACK_ADMIN_RESPONSE_MAX_LENGTH,
  FEEDBACK_DESCRIPTION_MAX_LENGTH,
  FEEDBACK_DESCRIPTION_MIN_LENGTH,
  FEEDBACK_TITLE_MAX_LENGTH,
  FEEDBACK_TITLE_MIN_LENGTH,
  feedbackEditSchema,
  feedbackFormSchema,
  feedbackModerationSchema,
  feedbackRefSchema,
  feedbackVoteSchema,
} from "./feedback";

const ID = "0199a000-0000-7000-8000-00000000f001";
const OTHER = "0199a000-0000-7000-8000-00000000f002";
const CLUB = "019a1b2c-3d4e-7f00-8a00-1234567890ab";

const DESCRIPTION = "Kalenderen viser fredag i stedet for lørdag.";

function bug(overrides: Record<string, unknown> = {}) {
  return {
    type: "BUG",
    title: "Forkert dato",
    description: DESCRIPTION,
    pagePath: "/calendar",
    viewportWidth: "390",
    ...overrides,
  };
}

/** The field errors of a failed parse ({ field: [messages] }). */
function fieldErrors(result: { success: boolean; error?: { issues: unknown[] } }) {
  expect(result.success).toBe(false);
  const errors: Record<string, string[]> = {};
  for (const issue of (result.error?.issues ?? []) as { path: PropertyKey[]; message: string }[]) {
    (errors[issue.path.map(String).join(".")] ??= []).push(issue.message);
  }
  return errors;
}

describe("feedbackFormSchema (SPEC §9.9)", () => {
  it("accepts a bug with its page and screen width", () => {
    expect(feedbackFormSchema.parse(bug())).toEqual({
      type: "BUG",
      title: "Forkert dato",
      description: DESCRIPTION,
      pagePath: "/calendar",
      viewportWidth: 390,
    });
  });

  it("removes the club id, query and hash from the page (E26)", () => {
    const data = feedbackFormSchema.parse(bug({ pagePath: `/c/${CLUB}/calendar?x=1#y` }));
    expect(data.pagePath).toBe("/calendar");
    expect(JSON.stringify(data)).not.toContain(CLUB);
  });

  it("drops the page and the width for a feature, whatever was sent", () => {
    const data = feedbackFormSchema.parse(
      bug({ type: "FEATURE", pagePath: "ikke en sti", viewportWidth: "390" }),
    );
    expect(data).toMatchObject({ type: "FEATURE", pagePath: null, viewportWidth: null });
  });

  it("refuses a bug page that is not a path, and allows none", () => {
    expect(fieldErrors(feedbackFormSchema.safeParse(bug({ pagePath: "kalender" })))).toEqual({
      pagePath: ["Skriv en sti, fx /calendar."],
    });
    expect(fieldErrors(feedbackFormSchema.safeParse(bug({ pagePath: "//evil.com" })))).toEqual({
      pagePath: ["Skriv en sti, fx /calendar."],
    });
    expect(feedbackFormSchema.parse(bug({ pagePath: "  " })).pagePath).toBeNull();
    expect(feedbackFormSchema.parse(bug({ pagePath: undefined })).pagePath).toBeNull();
    // The page error shows even when another field is wrong too (F-037).
    expect(
      fieldErrors(feedbackFormSchema.safeParse(bug({ pagePath: "https://x", title: "" }))),
    ).toMatchObject({ pagePath: ["Skriv en sti, fx /calendar."] });
  });

  it("drops an invalid screen width silently", () => {
    for (const width of ["0", "-1", "20001", "39.5", "abc", "", "9".repeat(30), 1e9]) {
      expect(feedbackFormSchema.parse(bug({ viewportWidth: width })).viewportWidth).toBeNull();
    }
    expect(feedbackFormSchema.parse(bug({ viewportWidth: "1" })).viewportWidth).toBe(1);
    expect(feedbackFormSchema.parse(bug({ viewportWidth: "20000" })).viewportWidth).toBe(20_000);
    expect(feedbackFormSchema.parse(bug({ viewportWidth: 1280 })).viewportWidth).toBe(1280);
  });

  it("requires a known type", () => {
    for (const type of [undefined, "", "bug", "IDEA"]) {
      expect(fieldErrors(feedbackFormSchema.safeParse(bug({ type })))).toEqual({
        type: ["Vælg, om det er en fejl eller en idé."],
      });
    }
  });

  it("checks the title at its boundaries (3–120, cleaned)", () => {
    expect(FEEDBACK_TITLE_MIN_LENGTH).toBe(3);
    expect(FEEDBACK_TITLE_MAX_LENGTH).toBe(120);
    const tooShort = { title: ["Titlen skal være mindst 3 tegn."] };
    const tooLong = { title: ["Titlen må højst være 120 tegn."] };
    expect(fieldErrors(feedbackFormSchema.safeParse(bug({ title: "ab" })))).toEqual(tooShort);
    // Whitespace is collapsed before counting: "  a   b  " is "a b" (3), "  ab  " is 2.
    expect(fieldErrors(feedbackFormSchema.safeParse(bug({ title: "   ab   " })))).toEqual(tooShort);
    expect(feedbackFormSchema.parse(bug({ title: "  a   b  " })).title).toBe("a b");
    expect(fieldErrors(feedbackFormSchema.safeParse(bug({ title: undefined })))).toEqual(tooShort);
    expect(feedbackFormSchema.parse(bug({ title: "abc" })).title).toBe("abc");
    expect(feedbackFormSchema.parse(bug({ title: "x".repeat(120) })).title).toHaveLength(120);
    expect(fieldErrors(feedbackFormSchema.safeParse(bug({ title: "x".repeat(121) })))).toEqual(
      tooLong,
    );
    expect(feedbackFormSchema.parse(bug({ title: "  Forkert \n\t dato\u0000 " })).title).toBe(
      "Forkert dato",
    );
  });

  it("counts characters like Postgres (an emoji is one)", () => {
    expect(fieldErrors(feedbackFormSchema.safeParse(bug({ title: "🍺🍺" })))).toEqual({
      title: ["Titlen skal være mindst 3 tegn."],
    });
    expect(feedbackFormSchema.parse(bug({ title: "🍺".repeat(120) })).title).toBe("🍺".repeat(120));
    expect(fieldErrors(feedbackFormSchema.safeParse(bug({ description: "🍺".repeat(9) })))).toEqual(
      { description: ["Beskriv det med mindst 10 tegn."] },
    );
  });

  it("checks the description at its boundaries (10–5000, line breaks kept)", () => {
    expect(FEEDBACK_DESCRIPTION_MIN_LENGTH).toBe(10);
    expect(FEEDBACK_DESCRIPTION_MAX_LENGTH).toBe(5000);
    expect(fieldErrors(feedbackFormSchema.safeParse(bug({ description: "x".repeat(9) })))).toEqual({
      description: ["Beskriv det med mindst 10 tegn."],
    });
    expect(feedbackFormSchema.parse(bug({ description: "x".repeat(10) })).description).toBe(
      "x".repeat(10),
    );
    expect(
      feedbackFormSchema.parse(bug({ description: "x".repeat(5000) })).description,
    ).toHaveLength(5000);
    expect(
      fieldErrors(feedbackFormSchema.safeParse(bug({ description: "x".repeat(5001) }))),
    ).toEqual({ description: ["Beskrivelsen må højst være 5000 tegn."] });
    expect(
      feedbackFormSchema.parse(bug({ description: "  Linje 1\r\nLinje 2\rLinje\u0000 3  " }))
        .description,
    ).toBe("Linje 1\nLinje 2\nLinje 3");
  });

  it("refuses overlong raw input before cleaning it (D-090)", () => {
    expect(
      fieldErrors(feedbackFormSchema.safeParse(bug({ title: " ".repeat(100_000) + "abc" }))),
    ).toEqual({ title: ["Titlen må højst være 120 tegn."] });
    expect(
      fieldErrors(feedbackFormSchema.safeParse(bug({ description: "\n".repeat(30_000) + "x" }))),
    ).toEqual({ description: ["Beskrivelsen må højst være 5000 tegn."] });
    expect(
      fieldErrors(feedbackFormSchema.safeParse(bug({ pagePath: `/${"a".repeat(3000)}` }))),
    ).toEqual({ pagePath: ["Skriv en sti, fx /calendar."] });
  });
});

describe("cleanFeedbackDescription", () => {
  it("normalises to NFC", () => {
    expect(cleanFeedbackDescription("Blåbær")).toBe("Blåbær");
  });
});

describe("feedbackEditSchema", () => {
  it("takes the id, title and description with the same rules", () => {
    expect(
      feedbackEditSchema.parse({ feedbackId: ID, title: " Ny titel ", description: DESCRIPTION }),
    ).toEqual({ feedbackId: ID, title: "Ny titel", description: DESCRIPTION });
    expect(
      fieldErrors(
        feedbackEditSchema.safeParse({ feedbackId: "x", title: "ab", description: "kort" }),
      ),
    ).toEqual({
      feedbackId: ["Ugyldigt id."],
      title: ["Titlen skal være mindst 3 tegn."],
      description: ["Beskriv det med mindst 10 tegn."],
    });
  });
});

describe("feedbackModerationSchema (E28)", () => {
  const base = { feedbackId: ID, status: "PLANNED", adminResponse: "", duplicateOfId: "" };

  it("accepts every status and cleans the answer", () => {
    for (const status of ["NEW", "PLANNED", "IN_PROGRESS", "DONE", "WONT_DO"]) {
      expect(feedbackModerationSchema.parse({ ...base, status })).toEqual({
        feedbackId: ID,
        status,
        adminResponse: null,
        duplicateOfId: null,
      });
    }
    expect(
      feedbackModerationSchema.parse({ ...base, adminResponse: "  Rettet\r\ni dag\u0000  " })
        .adminResponse,
    ).toBe("Rettet\ni dag");
  });

  it("refuses an unknown status", () => {
    expect(fieldErrors(feedbackModerationSchema.safeParse({ ...base, status: "CLOSED" }))).toEqual({
      status: ["Vælg en status."],
    });
  });

  it("caps the answer at 2000 characters", () => {
    expect(FEEDBACK_ADMIN_RESPONSE_MAX_LENGTH).toBe(2000);
    expect(
      feedbackModerationSchema.parse({ ...base, adminResponse: "x".repeat(2000) }).adminResponse,
    ).toHaveLength(2000);
    expect(
      fieldErrors(feedbackModerationSchema.safeParse({ ...base, adminResponse: "x".repeat(2001) })),
    ).toEqual({ adminResponse: ["Svaret må højst være 2000 tegn."] });
  });

  it("requires the original for DUPLICATE, never the report itself", () => {
    expect(
      feedbackModerationSchema.parse({ ...base, status: "DUPLICATE", duplicateOfId: OTHER }),
    ).toMatchObject({ status: "DUPLICATE", duplicateOfId: OTHER });
    expect(
      fieldErrors(feedbackModerationSchema.safeParse({ ...base, status: "DUPLICATE" })),
    ).toEqual({ duplicateOfId: ["Vælg den originale rapport."] });
    expect(
      fieldErrors(
        feedbackModerationSchema.safeParse({ ...base, status: "DUPLICATE", duplicateOfId: ID }),
      ),
    ).toEqual({ duplicateOfId: ["En rapport kan ikke være dublet af sig selv."] });
    expect(
      fieldErrors(
        feedbackModerationSchema.safeParse({ ...base, status: "DUPLICATE", duplicateOfId: "nej" }),
      ),
    ).toEqual({ duplicateOfId: ["Vælg den originale rapport."] });
  });

  it("ignores the original for any other status", () => {
    expect(
      feedbackModerationSchema.parse({ ...base, status: "DONE", duplicateOfId: OTHER })
        .duplicateOfId,
    ).toBeNull();
  });
});

describe("feedbackVoteSchema and feedbackRefSchema", () => {
  it("reads the desired 👍 state", () => {
    for (const voted of [true, "1", "true", "on"]) {
      expect(feedbackVoteSchema.parse({ feedbackId: ID, voted }).voted).toBe(true);
    }
    for (const voted of [false, "0", "false"]) {
      expect(feedbackVoteSchema.parse({ feedbackId: ID, voted }).voted).toBe(false);
    }
    expect(feedbackVoteSchema.safeParse({ feedbackId: ID, voted: "ja" }).success).toBe(false);
    expect(feedbackVoteSchema.safeParse({ feedbackId: ID }).success).toBe(false);
  });

  it("refuses a malformed id", () => {
    expect(feedbackRefSchema.safeParse({ feedbackId: ID }).success).toBe(true);
    expect(feedbackRefSchema.safeParse({ feedbackId: "ikke-et-id" }).success).toBe(false);
    expect(feedbackRefSchema.safeParse({}).success).toBe(false);
  });
});
