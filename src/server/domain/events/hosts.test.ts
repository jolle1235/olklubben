import { describe, expect, it } from "vitest";

import { defaultHostIds, MAX_EVENT_HOSTS, resolveHostIds, sameIdSet, suggestHosts } from "./hosts";

const MADS = "mads";
const ANDERS = "anders";
const JESPER = "jesper";
const BO = "bo";
const OUTSIDER = "outsider";

const members = new Set([MADS, ANDERS, JESPER, BO]);

describe("defaultHostIds (SPEC §9.2, D-098)", () => {
  it("uses the place's owners", () => {
    expect(
      defaultHostIds({ ownerIds: [MADS, ANDERS], fallbackUserIds: [JESPER], memberIds: members }),
    ).toEqual([MADS, ANDERS]);
  });

  it("leaves out an owner who left the club", () => {
    expect(
      defaultHostIds({ ownerIds: [OUTSIDER, MADS], fallbackUserIds: [JESPER], memberIds: members }),
    ).toEqual([MADS]);
  });

  it("falls back to the creator when the place has no owners (or none are members)", () => {
    expect(defaultHostIds({ ownerIds: [], fallbackUserIds: [JESPER], memberIds: members })).toEqual(
      [JESPER],
    );
    expect(
      defaultHostIds({ ownerIds: [OUTSIDER], fallbackUserIds: [JESPER], memberIds: members }),
    ).toEqual([JESPER]);
  });

  it("falls back to the editor when the creator left (edit)", () => {
    expect(
      defaultHostIds({ ownerIds: [], fallbackUserIds: [OUTSIDER, BO], memberIds: members }),
    ).toEqual([BO]);
  });

  it("gives nobody when no fallback is a member", () => {
    expect(
      defaultHostIds({ ownerIds: [], fallbackUserIds: [OUTSIDER], memberIds: members }),
    ).toEqual([]);
    expect(defaultHostIds({ ownerIds: [], fallbackUserIds: [], memberIds: members })).toEqual([]);
  });

  it("removes duplicate owners and keeps their order", () => {
    expect(
      defaultHostIds({ ownerIds: [ANDERS, MADS, ANDERS], fallbackUserIds: [], memberIds: members }),
    ).toEqual([ANDERS, MADS]);
  });

  it("never gives more than MAX_EVENT_HOSTS", () => {
    const many = Array.from({ length: 25 }, (_, i) => `u${i}`);
    expect(
      defaultHostIds({ ownerIds: many, fallbackUserIds: [], memberIds: new Set(many) }),
    ).toHaveLength(MAX_EVENT_HOSTS);
  });
});

describe("resolveHostIds", () => {
  const base = {
    ownerIds: [MADS],
    fallbackUserIds: [JESPER],
    memberIds: members,
    existingHostIds: [] as string[],
  };

  it("uses the default for an empty request", () => {
    expect(resolveHostIds({ ...base, requested: [] })).toEqual({ ok: true, hostIds: [MADS] });
    expect(resolveHostIds({ ...base, ownerIds: [], requested: [] })).toEqual({
      ok: true,
      hostIds: [JESPER],
    });
  });

  it("keeps the chosen members, without duplicates", () => {
    expect(resolveHostIds({ ...base, requested: [BO, ANDERS, BO] })).toEqual({
      ok: true,
      hostIds: [BO, ANDERS],
    });
  });

  it("refuses an outsider and names them", () => {
    expect(resolveHostIds({ ...base, requested: [BO, OUTSIDER, OUTSIDER] })).toEqual({
      ok: false,
      userIds: [OUTSIDER],
    });
  });

  it("keeps an ex-member who already hosts the event (edit)", () => {
    expect(
      resolveHostIds({ ...base, requested: [OUTSIDER, BO], existingHostIds: [OUTSIDER] }),
    ).toEqual({ ok: true, hostIds: [OUTSIDER, BO] });
  });
});

describe("suggestHosts (the picker's hint)", () => {
  it("suggests the owners who are members", () => {
    expect(
      suggestHosts({ ownerIds: [MADS, OUTSIDER], memberIds: members, fallbackUserId: JESPER }),
    ).toEqual({ hostIds: [MADS], reason: "owners" });
  });

  it("suggests the user when the place has no owners", () => {
    expect(suggestHosts({ ownerIds: [], memberIds: members, fallbackUserId: JESPER })).toEqual({
      hostIds: [JESPER],
      reason: "fallback",
    });
    expect(
      suggestHosts({ ownerIds: [OUTSIDER], memberIds: members, fallbackUserId: JESPER }),
    ).toEqual({ hostIds: [JESPER], reason: "fallback" });
  });

  it("suggests the user's own place as owners when the user owns it", () => {
    expect(
      suggestHosts({ ownerIds: [JESPER], memberIds: members, fallbackUserId: JESPER }),
    ).toEqual({ hostIds: [JESPER], reason: "owners" });
  });
});

describe("sameIdSet", () => {
  it("ignores order and duplicates", () => {
    expect(sameIdSet([MADS, ANDERS], [ANDERS, MADS, MADS])).toBe(true);
    expect(sameIdSet([], [])).toBe(true);
  });

  it("sees a missing or extra id", () => {
    expect(sameIdSet([MADS], [MADS, ANDERS])).toBe(false);
    expect(sameIdSet([MADS, BO], [MADS, ANDERS])).toBe(false);
  });
});
