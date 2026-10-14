import { describe, expect, it } from "vitest";

import { eventFieldsFromPoll, pollEventHostIds } from "./event-from-poll";

describe("eventFieldsFromPoll (§9.7.7)", () => {
  it("copies the texts, takes the winner and keeps the poll's creator", () => {
    const startsAt = new Date("2026-11-21T17:30:00.000Z");
    expect(
      eventFieldsFromPoll(
        {
          title: "Ølsmagning #15",
          theme: "Juleøl",
          description: "Linje 1\nLinje 2",
          createdById: "c",
        },
        { startsAt, placeId: "place" },
      ),
    ).toEqual({
      title: "Ølsmagning #15",
      theme: "Juleøl",
      description: "Linje 1\nLinje 2",
      startsAt,
      endsAt: null,
      placeId: "place",
      createdById: "c",
    });
  });
});

describe("pollEventHostIds (D-009, D-131, E10, E11)", () => {
  const members = (...ids: string[]) => new Set(ids);

  it("makes the winning place's member owners the hosts", () => {
    expect(
      pollEventHostIds({
        ownerIds: ["o1", "o2"],
        creatorId: "c",
        actorUserId: "admin",
        memberIds: members("o1", "o2", "c", "admin"),
      }),
    ).toEqual(["o1", "o2"]);
  });

  it("falls back to the creator when the owners have left or there are none (E10)", () => {
    expect(
      pollEventHostIds({
        ownerIds: ["gone"],
        creatorId: "c",
        actorUserId: null,
        memberIds: members("c"),
      }),
    ).toEqual(["c"]);
    expect(
      pollEventHostIds({
        ownerIds: [],
        creatorId: "c",
        actorUserId: "admin",
        memberIds: members("c", "admin"),
      }),
    ).toEqual(["c"]);
  });

  it("falls back to the acting admin when the creator has left (E11)", () => {
    expect(
      pollEventHostIds({
        ownerIds: [],
        creatorId: "c",
        actorUserId: "admin",
        memberIds: members("admin"),
      }),
    ).toEqual(["admin"]);
  });

  it("gives no host on an automatic close with the creator gone and no owners (E34)", () => {
    expect(
      pollEventHostIds({
        ownerIds: [],
        creatorId: "c",
        actorUserId: null,
        memberIds: members("x"),
      }),
    ).toEqual([]);
  });
});
