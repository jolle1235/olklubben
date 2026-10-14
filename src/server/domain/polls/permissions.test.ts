import { describe, expect, it } from "vitest";

import type { PollStatus } from "./options";
import {
  canCancelPoll,
  canClosePoll,
  canCreatePoll,
  canEditPoll,
  canManagePoll,
  canResolveTie,
  canVote,
} from "./permissions";

const CREATOR = "creator";
const ADMIN = { role: "ADMIN" as const };
const MEMBER = { role: "MEMBER" as const };
const STATUSES: PollStatus[] = ["OPEN", "AWAITING_DECISION", "CLOSED", "CANCELLED"];

type Who = { label: string; membership: typeof ADMIN | typeof MEMBER | null; userId: string };
const WHO: Who[] = [
  { label: "admin", membership: ADMIN, userId: "admin" },
  { label: "admin who created it", membership: ADMIN, userId: CREATOR },
  { label: "creator (member)", membership: MEMBER, userId: CREATOR },
  { label: "other member", membership: MEMBER, userId: "member" },
  { label: "creator who left", membership: null, userId: CREATOR },
  { label: "non-member", membership: null, userId: "outsider" },
];

const manages = (who: Who) => who.membership !== null && who.label !== "other member";

describe("canCreatePoll / canVote (§5.1)", () => {
  it("lets every member plan and vote, nobody else", () => {
    expect(canCreatePoll(ADMIN)).toBe(true);
    expect(canCreatePoll(MEMBER)).toBe(true);
    expect(canCreatePoll(null)).toBe(false);
    expect(canCreatePoll(undefined)).toBe(false);
    expect(canVote(MEMBER)).toBe(true);
    expect(canVote(null)).toBe(false);
  });
});

describe("managing a poll (§5.1, D-133, E11)", () => {
  for (const who of WHO) {
    for (const status of STATUSES) {
      it(`${who.label}, ${status}`, () => {
        const poll = { createdById: CREATOR, status };
        const m = manages(who);
        expect(canManagePoll(who.membership, poll, who.userId)).toBe(m);
        expect(canEditPoll(who.membership, poll, who.userId)).toBe(m && status === "OPEN");
        expect(canClosePoll(who.membership, poll, who.userId)).toBe(m && status === "OPEN");
        expect(canCancelPoll(who.membership, poll, who.userId)).toBe(
          m && (status === "OPEN" || status === "AWAITING_DECISION"),
        );
        expect(canResolveTie(who.membership, poll, who.userId)).toBe(
          m && status === "AWAITING_DECISION",
        );
      });
    }
  }
});
