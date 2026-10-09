import { describe, expect, it } from "vitest";

import {
  canDeleteClub,
  canEditClubInfo,
  canGeneratePasswordResetLink,
  canManageMembers,
  canRegenerateInvite,
  canResetMemberPassword,
  canViewInvite,
  CLUB_ROLE_LABEL,
  CLUB_ROLES,
  isAdmin,
  type MembershipRole,
} from "./permissions";

const admin: MembershipRole = { role: "ADMIN" };
const member: MembershipRole = { role: "MEMBER" };

describe("club permissions (SPEC §5.1)", () => {
  it("isAdmin is true only for ADMIN", () => {
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(member)).toBe(false);
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });

  it("every member may see and share the invitation link", () => {
    expect(canViewInvite(admin)).toBe(true);
    expect(canViewInvite(member)).toBe(true);
    expect(canViewInvite(null)).toBe(false);
  });

  it("only admins may generate a new invitation code", () => {
    expect(canRegenerateInvite(admin)).toBe(true);
    expect(canRegenerateInvite(member)).toBe(false);
    expect(canRegenerateInvite(undefined)).toBe(false);
  });

  it("only admins may generate a password reset link", () => {
    expect(canGeneratePasswordResetLink(admin)).toBe(true);
    expect(canGeneratePasswordResetLink(member)).toBe(false);
    expect(canGeneratePasswordResetLink(null)).toBe(false);
  });

  it("a reset link only targets members whose every club the caller administers, without Google", () => {
    expect(
      canResetMemberPassword({
        targetHasClubWhereCallerIsNotAdmin: false,
        targetHasExternalLogin: false,
      }),
    ).toBe(true);
    expect(
      canResetMemberPassword({
        targetHasClubWhereCallerIsNotAdmin: true,
        targetHasExternalLogin: false,
      }),
    ).toBe(false);
    expect(
      canResetMemberPassword({
        targetHasClubWhereCallerIsNotAdmin: false,
        targetHasExternalLogin: true,
      }),
    ).toBe(false);
    expect(
      canResetMemberPassword({
        targetHasClubWhereCallerIsNotAdmin: true,
        targetHasExternalLogin: true,
      }),
    ).toBe(false);
  });

  it("only admins may manage members, edit the club info and delete the club (round 3)", () => {
    for (const can of [canManageMembers, canEditClubInfo, canDeleteClub]) {
      expect(can(admin)).toBe(true);
      expect(can(member)).toBe(false);
      expect(can(null)).toBe(false);
      expect(can(undefined)).toBe(false);
    }
  });

  it("has a Danish label for every role", () => {
    expect(CLUB_ROLES).toEqual(["ADMIN", "MEMBER"]);
    expect(CLUB_ROLE_LABEL).toEqual({ ADMIN: "Admin", MEMBER: "Medlem" });
  });
});
