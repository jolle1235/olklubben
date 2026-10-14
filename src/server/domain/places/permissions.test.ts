import { describe, expect, it } from "vitest";

import type { MembershipRole } from "@/server/domain/clubs/permissions";

import {
  canCreatePlace,
  canEditPlace,
  canRemovePlace,
  canRemovePlaceOwner,
  canRestorePlace,
  canSetOwnOwnership,
  isPlaceOwner,
  isPlaceUnused,
  placeRemoval,
  placeRemovalBlock,
  type PlaceAccess,
  type PlaceUsage,
} from "./permissions";

const OWNER = "0199a000-0000-7000-8000-0000000000a1";
const CREATOR = "0199a000-0000-7000-8000-0000000000a2";
const MEMBER = "0199a000-0000-7000-8000-0000000000a3";
const ADMIN = "0199a000-0000-7000-8000-0000000000a4";

const member: MembershipRole = { role: "MEMBER" };
const admin: MembershipRole = { role: "ADMIN" };

function place(archived: boolean): PlaceAccess {
  return {
    createdById: CREATOR,
    ownerIds: [OWNER],
    archivedAt: archived ? new Date("2026-10-01T00:00:00Z") : null,
  };
}

const usage = (patch: Partial<PlaceUsage> = {}): PlaceUsage => ({
  eventCount: 0,
  pollOptionCount: 0,
  activePollCount: 0,
  ...patch,
});
const USED = usage({ eventCount: 3 });
const UNUSED = usage();
/** Only ever in a finished (CLOSED/CANCELLED) poll: used, not blocked. */
const POLL_ONLY = usage({ pollOptionCount: 1 });
/** In an OPEN or AWAITING_DECISION poll (E5). */
const IN_ACTIVE_POLL = usage({ pollOptionCount: 1, activePollCount: 1 });

type Actor = "none" | "member" | "owner" | "creator" | "admin";

const actors: Record<Actor, { membership: MembershipRole | null; userId: string }> = {
  none: { membership: null, userId: OWNER },
  member: { membership: member, userId: MEMBER },
  owner: { membership: member, userId: OWNER },
  creator: { membership: member, userId: CREATOR },
  admin: { membership: admin, userId: ADMIN },
};

describe("place permissions (SPEC §5.1, §9.4, D-100)", () => {
  it("every member may create and edit places, archived ones too; a non-member may not", () => {
    for (const can of [canCreatePlace, canEditPlace, canSetOwnOwnership]) {
      expect(can(member)).toBe(true);
      expect(can(admin)).toBe(true);
      expect(can(null)).toBe(false);
      expect(can(undefined)).toBe(false);
    }
  });

  it("isPlaceOwner looks at the owner ids", () => {
    expect(isPlaceOwner(place(false), OWNER)).toBe(true);
    expect(isPlaceOwner(place(false), CREATOR)).toBe(false);
  });

  it("an owner removes themself; an admin removes anyone; a member nobody else", () => {
    expect(canRemovePlaceOwner(member, OWNER, OWNER)).toBe(true);
    expect(canRemovePlaceOwner(member, MEMBER, OWNER)).toBe(false);
    expect(canRemovePlaceOwner(admin, ADMIN, OWNER)).toBe(true);
    expect(canRemovePlaceOwner(null, OWNER, OWNER)).toBe(false);
  });

  it("placeRemoval archives a used place and deletes an unused one", () => {
    expect(placeRemoval(USED)).toBe("archive");
    expect(placeRemoval(usage({ eventCount: 1 }))).toBe("archive");
    expect(placeRemoval(UNUSED)).toBe("delete");
  });

  it("a place that has been a poll option is used: archived, never deleted (D-132)", () => {
    expect(isPlaceUnused(POLL_ONLY)).toBe(false);
    expect(placeRemoval(POLL_ONLY)).toBe("archive");
    expect(isPlaceUnused(UNUSED)).toBe(true);
    expect(isPlaceUnused(USED)).toBe(false);
  });

  it("placeRemovalBlock: only a poll that is not finished blocks removal (E5)", () => {
    expect(placeRemovalBlock(IN_ACTIVE_POLL)).toBe("in-active-poll");
    expect(placeRemovalBlock(usage({ eventCount: 2, pollOptionCount: 3, activePollCount: 2 }))).toBe(
      "in-active-poll",
    );
    expect(placeRemovalBlock(POLL_ONLY)).toBeNull();
    expect(placeRemovalBlock(USED)).toBeNull();
    expect(placeRemovalBlock(UNUSED)).toBeNull();
  });

  // The full matrix: actor × used/unused × active/archived.
  const removeExpected: Record<Actor, { used: boolean; unused: boolean }> = {
    none: { used: false, unused: false },
    member: { used: false, unused: false },
    owner: { used: true, unused: true },
    creator: { used: false, unused: true },
    admin: { used: true, unused: true },
  };
  const restoreExpected: Record<Actor, boolean> = {
    none: false,
    member: false,
    owner: true,
    creator: false,
    admin: true,
  };

  for (const [actor, { membership, userId }] of Object.entries(actors) as [
    Actor,
    (typeof actors)[Actor],
  ][]) {
    describe(`as ${actor}`, () => {
      it("removes an active place per the matrix (archive used: owner/admin; delete unused: + creator)", () => {
        expect(canRemovePlace(membership, place(false), userId, USED)).toBe(
          removeExpected[actor].used,
        );
        expect(canRemovePlace(membership, place(false), userId, UNUSED)).toBe(
          removeExpected[actor].unused,
        );
      });

      it("never removes a place in an active poll (E5), not even an admin or owner", () => {
        expect(canRemovePlace(membership, place(false), userId, IN_ACTIVE_POLL)).toBe(false);
      });

      it("treats a place only used in finished polls as used (creator may not delete it)", () => {
        expect(canRemovePlace(membership, place(false), userId, POLL_ONLY)).toBe(
          removeExpected[actor].used,
        );
      });

      it("never removes an archived place (restore it instead)", () => {
        expect(canRemovePlace(membership, place(true), userId, USED)).toBe(false);
        expect(canRemovePlace(membership, place(true), userId, UNUSED)).toBe(false);
      });

      it("restores an archived place only as owner or admin, never an active one", () => {
        expect(canRestorePlace(membership, place(true), userId)).toBe(restoreExpected[actor]);
        expect(canRestorePlace(membership, place(false), userId)).toBe(false);
      });
    });
  }
});
