import { describe, expect, it } from "vitest";

import { canCreateEvent, canDeleteEvent, canEditEvent } from "./permissions";

const CREATOR = "0199a000-0000-7000-8000-0000000000a1";
const OTHER = "0199a000-0000-7000-8000-0000000000a2";
const event = { createdById: CREATOR };

describe("event permissions (SPEC §5.1, D-061)", () => {
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

      it("allows an admin who did not create it", () => {
        expect(can({ role: "ADMIN" }, event, OTHER)).toBe(true);
      });

      it("refuses another member", () => {
        expect(can({ role: "MEMBER" }, event, OTHER)).toBe(false);
      });

      it("refuses a non-member, even the former creator", () => {
        expect(can(null, event, CREATOR)).toBe(false);
        expect(can(undefined, event, CREATOR)).toBe(false);
      });
    });
  }
});
