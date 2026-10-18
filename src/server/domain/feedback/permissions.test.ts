import { describe, expect, it } from "vitest";

import {
  canCreateFeedback,
  canDeleteFeedback,
  canEditFeedback,
  canModerateFeedback,
  canSeeFeedbackTechInfo,
  canViewFeedback,
  canVoteOnFeedback,
  type FeedbackViewer,
} from "./permissions";
import { FEEDBACK_STATUSES } from "./status";

const AUTHOR = "author";

type Who = { label: string; viewer: FeedbackViewer; isAuthor: boolean };
const WHO: Who[] = [
  { label: "stranger", viewer: { userId: "stranger", isAppAdmin: false }, isAuthor: false },
  { label: "author", viewer: { userId: AUTHOR, isAppAdmin: false }, isAuthor: true },
  { label: "app-admin", viewer: { userId: "admin", isAppAdmin: true }, isAuthor: false },
  { label: "app-admin author", viewer: { userId: AUTHOR, isAppAdmin: true }, isAuthor: true },
];

describe("feedback permissions (SPEC §9.9, D-145)", () => {
  for (const who of WHO) {
    for (const status of FEEDBACK_STATUSES) {
      it(`${who.label}, ${status}`, () => {
        const feedback = { createdById: AUTHOR, status };
        const isAdmin = who.viewer.isAppAdmin;
        expect(canViewFeedback(who.viewer)).toBe(true);
        expect(canCreateFeedback(who.viewer)).toBe(true);
        expect(canVoteOnFeedback(who.viewer, feedback)).toBe(!who.isAuthor);
        const authorWhileNew = who.isAuthor && status === "NEW";
        expect(canEditFeedback(who.viewer, feedback)).toBe(isAdmin || authorWhileNew);
        expect(canDeleteFeedback(who.viewer, feedback)).toBe(isAdmin || authorWhileNew);
        expect(canModerateFeedback(who.viewer)).toBe(isAdmin);
        expect(canSeeFeedbackTechInfo(who.viewer)).toBe(isAdmin);
      });
    }
  }

  it("a report from a deleted account (createdById null) has no author", () => {
    for (const status of FEEDBACK_STATUSES) {
      const orphan = { createdById: null, status };
      const user = { userId: "someone", isAppAdmin: false };
      const admin = { userId: "admin", isAppAdmin: true };
      expect(canVoteOnFeedback(user, orphan)).toBe(true);
      expect(canEditFeedback(user, orphan)).toBe(false);
      expect(canDeleteFeedback(user, orphan)).toBe(false);
      expect(canEditFeedback(admin, orphan)).toBe(true);
      expect(canDeleteFeedback(admin, orphan)).toBe(true);
    }
  });

  it("an empty user id never matches a missing author", () => {
    expect(
      canEditFeedback({ userId: "", isAppAdmin: false }, { createdById: null, status: "NEW" }),
    ).toBe(false);
  });
});
