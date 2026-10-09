import { describe, expect, it } from "vitest";

import {
  adminCount,
  decideMembershipChange,
  isClubNameConfirmed,
  leaveBlock,
  MEMBERSHIP_MESSAGES,
  memberMenu,
  type MembershipDecision,
  type Roster,
} from "./membership-rules";
import type { ClubRole } from "./permissions";

const A = "admin-a";
const B = "admin-b";
const M = "member-m";
const N = "member-n";
const X = "outsider";

function roster(entries: Record<string, ClubRole>): Roster {
  return new Map(Object.entries(entries));
}

const refused = (reason: string): MembershipDecision =>
  ({ ok: false, reason }) as MembershipDecision;
const allowed = (effect: string): MembershipDecision =>
  ({ ok: true, effect }) as MembershipDecision;

const oneAdmin = roster({ [A]: "ADMIN", [M]: "MEMBER", [N]: "MEMBER" });
const twoAdmins = roster({ [A]: "ADMIN", [B]: "ADMIN", [M]: "MEMBER" });
const onlyMember = roster({ [A]: "ADMIN" });

/** Applies an allowed change to a roster, like the data layer does under the lock. */
function apply(
  current: Roster,
  actor: string,
  change: Parameters<typeof decideMembershipChange>[1],
) {
  const decision = decideMembershipChange(actor, change, current);
  const next = new Map(current);
  if (decision.ok && decision.effect === "setRole" && change.kind === "setRole") {
    next.set(change.targetUserId, change.role);
  }
  if (decision.ok && decision.effect === "delete") {
    next.delete(change.kind === "leave" ? actor : change.targetUserId);
  }
  return { decision, next: next as Roster };
}

describe("adminCount", () => {
  it("counts the admins", () => {
    expect(adminCount(oneAdmin)).toBe(1);
    expect(adminCount(twoAdmins)).toBe(2);
    expect(adminCount(roster({}))).toBe(0);
  });
});

describe("decideMembershipChange: setRole (§5.1, E2)", () => {
  it("lets an admin promote a member", () => {
    expect(
      decideMembershipChange(A, { kind: "setRole", targetUserId: M, role: "ADMIN" }, oneAdmin),
    ).toEqual(allowed("setRole"));
  });

  it("lets an admin demote another admin while one stays", () => {
    expect(
      decideMembershipChange(A, { kind: "setRole", targetUserId: B, role: "MEMBER" }, twoAdmins),
    ).toEqual(allowed("setRole"));
  });

  it("is a no-op when the role is already right", () => {
    expect(
      decideMembershipChange(A, { kind: "setRole", targetUserId: M, role: "MEMBER" }, oneAdmin),
    ).toEqual(allowed("none"));
    expect(
      decideMembershipChange(A, { kind: "setRole", targetUserId: A, role: "ADMIN" }, oneAdmin),
    ).toEqual(allowed("none"));
  });

  it("refuses to demote the last admin, also yourself", () => {
    expect(
      decideMembershipChange(A, { kind: "setRole", targetUserId: A, role: "MEMBER" }, oneAdmin),
    ).toEqual(refused("LAST_ADMIN"));
  });

  it("lets an admin demote themself when another admin stays", () => {
    expect(
      decideMembershipChange(A, { kind: "setRole", targetUserId: A, role: "MEMBER" }, twoAdmins),
    ).toEqual(allowed("setRole"));
  });

  it("refuses a member actor", () => {
    expect(
      decideMembershipChange(M, { kind: "setRole", targetUserId: N, role: "ADMIN" }, oneAdmin),
    ).toEqual(refused("FORBIDDEN"));
    expect(
      decideMembershipChange(M, { kind: "setRole", targetUserId: M, role: "ADMIN" }, oneAdmin),
    ).toEqual(refused("FORBIDDEN"));
  });

  it("says NOT_FOUND for a non-member actor or target", () => {
    expect(
      decideMembershipChange(X, { kind: "setRole", targetUserId: M, role: "ADMIN" }, oneAdmin),
    ).toEqual(refused("NOT_FOUND"));
    expect(
      decideMembershipChange(A, { kind: "setRole", targetUserId: X, role: "ADMIN" }, oneAdmin),
    ).toEqual(refused("NOT_FOUND"));
  });
});

describe("decideMembershipChange: remove (§7.4, E2)", () => {
  it("lets an admin remove a member or another admin", () => {
    expect(decideMembershipChange(A, { kind: "remove", targetUserId: M }, oneAdmin)).toEqual(
      allowed("delete"),
    );
    expect(decideMembershipChange(A, { kind: "remove", targetUserId: B }, twoAdmins)).toEqual(
      allowed("delete"),
    );
  });

  it("sends yourself to 'Forlad klubben'", () => {
    expect(decideMembershipChange(A, { kind: "remove", targetUserId: A }, twoAdmins)).toEqual(
      refused("USE_LEAVE"),
    );
  });

  it("is idempotent for someone who is no longer a member", () => {
    expect(decideMembershipChange(A, { kind: "remove", targetUserId: X }, oneAdmin)).toEqual(
      allowed("none"),
    );
  });

  it("refuses a member actor and a non-member actor", () => {
    expect(decideMembershipChange(M, { kind: "remove", targetUserId: N }, oneAdmin)).toEqual(
      refused("FORBIDDEN"),
    );
    expect(decideMembershipChange(X, { kind: "remove", targetUserId: M }, oneAdmin)).toEqual(
      refused("NOT_FOUND"),
    );
  });
});

describe("decideMembershipChange: leave (§7.4, E2, E3)", () => {
  it("lets a member leave", () => {
    expect(decideMembershipChange(M, { kind: "leave" }, oneAdmin)).toEqual(allowed("delete"));
  });

  it("lets an admin leave when another admin stays", () => {
    expect(decideMembershipChange(A, { kind: "leave" }, twoAdmins)).toEqual(allowed("delete"));
  });

  it("refuses the last admin (E2)", () => {
    expect(decideMembershipChange(A, { kind: "leave" }, oneAdmin)).toEqual(refused("LAST_ADMIN"));
  });

  it("refuses the only member, who can delete the club instead (E3)", () => {
    expect(decideMembershipChange(A, { kind: "leave" }, onlyMember)).toEqual(
      refused("ONLY_MEMBER"),
    );
  });

  it("says NOT_FOUND for a non-member", () => {
    expect(decideMembershipChange(X, { kind: "leave" }, oneAdmin)).toEqual(refused("NOT_FOUND"));
  });
});

describe("races decided one after the other under the club lock (E25)", () => {
  it("A demotes B, then B demotes A: B is no longer an admin, A stays", () => {
    const first = apply(twoAdmins, A, { kind: "setRole", targetUserId: B, role: "MEMBER" });
    expect(first.decision).toEqual(allowed("setRole"));
    const second = apply(first.next, B, { kind: "setRole", targetUserId: A, role: "MEMBER" });
    expect(second.decision).toEqual(refused("FORBIDDEN"));
    expect(adminCount(second.next)).toBe(1);
  });

  it("both admins leave: the second one is the last admin", () => {
    const first = apply(twoAdmins, A, { kind: "leave" });
    expect(first.decision).toEqual(allowed("delete"));
    const second = apply(first.next, B, { kind: "leave" });
    expect(second.decision).toEqual(refused("LAST_ADMIN"));
    expect(adminCount(second.next)).toBe(1);
  });

  it("A removes B while B demotes themself: one admin always stays", () => {
    const removeFirst = apply(twoAdmins, A, { kind: "remove", targetUserId: B });
    const thenDemote = apply(removeFirst.next, B, {
      kind: "setRole",
      targetUserId: B,
      role: "MEMBER",
    });
    expect(thenDemote.decision).toEqual(refused("NOT_FOUND"));
    expect(adminCount(thenDemote.next)).toBe(1);

    const demoteFirst = apply(twoAdmins, B, { kind: "setRole", targetUserId: B, role: "MEMBER" });
    const thenRemove = apply(demoteFirst.next, A, { kind: "remove", targetUserId: B });
    expect(thenRemove.decision).toEqual(allowed("delete"));
    expect(adminCount(thenRemove.next)).toBe(1);
  });
});

describe("memberMenu", () => {
  it("is null for a non-admin viewer and for a non-member target", () => {
    expect(memberMenu(M, N, oneAdmin)).toBeNull();
    expect(memberMenu(X, M, oneAdmin)).toBeNull();
    expect(memberMenu(A, X, oneAdmin)).toBeNull();
  });

  it("offers promote, remove and a reset link for a member", () => {
    expect(memberMenu(A, M, oneAdmin)).toEqual({
      canPromote: true,
      canDemote: false,
      canRemove: true,
      canCreateResetLink: true,
      isSelf: false,
      demoteBlockedReason: null,
    });
  });

  it("offers demote and remove for another admin", () => {
    expect(memberMenu(A, B, twoAdmins)).toEqual({
      canPromote: false,
      canDemote: true,
      canRemove: true,
      canCreateResetLink: true,
      isSelf: false,
      demoteBlockedReason: null,
    });
  });

  it("offers self-demote with two admins, and blocks it for the last admin", () => {
    expect(memberMenu(A, A, twoAdmins)).toMatchObject({
      isSelf: true,
      canDemote: true,
      canRemove: false,
      canCreateResetLink: false,
      demoteBlockedReason: null,
    });
    expect(memberMenu(A, A, oneAdmin)).toMatchObject({
      isSelf: true,
      canDemote: false,
      canRemove: false,
      demoteBlockedReason: "LAST_ADMIN",
    });
  });
});

describe("leaveBlock", () => {
  it("explains why the user cannot leave, or null", () => {
    expect(leaveBlock(A, oneAdmin)).toBe("LAST_ADMIN");
    expect(leaveBlock(A, onlyMember)).toBe("ONLY_MEMBER");
    expect(leaveBlock(A, twoAdmins)).toBeNull();
    expect(leaveBlock(M, oneAdmin)).toBeNull();
    expect(leaveBlock(X, oneAdmin)).toBeNull();
  });
});

describe("isClubNameConfirmed (§7.5, D-103)", () => {
  const name = "Drengene & Bajere";

  it("accepts the name with other case and extra whitespace", () => {
    expect(isClubNameConfirmed(name, "  drengene &  BAJERE ")).toBe(true);
    expect(isClubNameConfirmed(name, "Drengene & Bajere")).toBe(true);
  });

  it("refuses a partial or empty name", () => {
    expect(isClubNameConfirmed(name, "Drengene")).toBe(false);
    expect(isClubNameConfirmed(name, "")).toBe(false);
    expect(isClubNameConfirmed(name, "   ")).toBe(false);
  });

  it("ignores NUL characters and folds Æ/Ø/Å", () => {
    expect(isClubNameConfirmed(name, "Drengene\u0000 & Bajere")).toBe(true);
    expect(isClubNameConfirmed("Ølklubben Århus", "ØLKLUBBEN ÅRHUS")).toBe(true);
    expect(isClubNameConfirmed("", "\u0000")).toBe(false);
  });
});

describe("MEMBERSHIP_MESSAGES", () => {
  it("has a Danish message for each refusal the UI shows", () => {
    expect(Object.keys(MEMBERSHIP_MESSAGES).sort()).toEqual(
      ["FORBIDDEN", "LAST_ADMIN", "LAST_ADMIN_LEAVE", "ONLY_MEMBER", "USE_LEAVE"].sort(),
    );
    expect(MEMBERSHIP_MESSAGES.LAST_ADMIN).toContain("mindst én admin");
  });
});
