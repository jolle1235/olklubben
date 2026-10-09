import { describe, expect, it } from "vitest";

import { canCreateEvent, canDeleteEvent, canEditEvent } from "./permissions";

const CREATOR = "0199a000-0000-7000-8000-0000000000a1";
const OTHER = "0199a000-0000-7000-8000-0000000000a2";
const HOST = "0199a000-0000-7000-8000-0000000000a3";
const event = { createdById: CREATOR, hostIds: [HOST] };

describe("event permissions (SPEC §5.1, D-098)", () => {
  it("every member may create an event, a non-member may not", () => {
    expect(canCreateEvent({ role: "MEMBER" })).toBe(true);
    expect(canCreateEvent({ role: "ADMIN" })).toBe(true);
    expect(canCreateEvent(null)).toBe(false);
    expect(canCreateEvent(undefined)).toBe(false);
  });

  for (const [name, can] of [
    ["canEditEvent", canEditEvent],
    ["canDeleteEvent", canDeleteEvent],
  ] as const) {
    describe(name, () => {
      it("allows the creator", () => {
        expect(can({ role: "MEMBER" }, event, CREATOR)).toBe(true);
      });

      it("allows a host who did not create it", () => {
        expect(can({ role: "MEMBER" }, event, HOST)).toBe(true);
      });

      it("refuses a former host (no longer in hostIds)", () => {
        expect(can({ role: "MEMBER" }, { createdById: CREATOR, hostIds: [] }, HOST)).toBe(false);
      });

      it("allows an admin who is neither creator nor host", () => {
        expect(can({ role: "ADMIN" }, event, OTHER)).toBe(true);
      });

      it("refuses another member", () => {
        expect(can({ role: "MEMBER" }, event, OTHER)).toBe(false);
      });

      it("refuses a non-member, even the creator or a listed host", () => {
        expect(can(null, event, CREATOR)).toBe(false);
        expect(can(null, event, HOST)).toBe(false);
        expect(can(undefined, event, HOST)).toBe(false);
      });
    });
  }
});
