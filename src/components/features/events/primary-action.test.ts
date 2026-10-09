import { describe, expect, it } from "vitest";

import { eventPrimaryAction } from "./primary-action";

const startsAt = new Date("2026-10-23T16:30:00Z"); // 18:30 in Copenhagen
const event = { startsAt };
const before = new Date("2026-10-23T16:29:59Z");
const atStart = startsAt;
const after = new Date("2026-11-02T12:00:00Z");

describe("eventPrimaryAction (SPEC §13.4.5)", () => {
  it("is 'Rediger' before the start for the creator or an admin", () => {
    expect(eventPrimaryAction(event, before, true)).toBe("edit");
  });

  it("is 'Tilføj øl' from the start, also for those who may edit", () => {
    expect(eventPrimaryAction(event, atStart, true)).toBe("addBeer");
    expect(eventPrimaryAction(event, after, true)).toBe("addBeer");
  });

  it("is always 'Tilføj øl' for members who may not edit", () => {
    expect(eventPrimaryAction(event, before, false)).toBe("addBeer");
    expect(eventPrimaryAction(event, after, false)).toBe("addBeer");
  });
});
