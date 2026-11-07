import { describe, expect, it } from "vitest";

import { defaultHostIds, MAX_EVENT_HOSTS, resolveHostIds, sameIdSet, suggestHosts } from "./hosts";

const MADS = "mads";
const ANDERS = "anders";
const JESPER = "jesper";
const BO = "bo";
const OUTSIDER = "outsider";

const members = new Set([MADS, ANDERS, JESPER, BO]);

describe("defaultHostIds (SPEC §9.2, D-098, D-175)", () => {
  it("uses the place's owners who are members, else nobody", () => {
    expect(defaultHostIds({ ownerIds: [MADS, ANDERS], memberIds: members })).toEqual([
      MADS,
      ANDERS,
    ]);
    expect(defaultHostIds({ ownerIds: [OUTSIDER, MADS], memberIds: members })).toEqual([MADS]);
    expect(defaultHostIds({ ownerIds: [OUTSIDER], memberIds: members })).toEqual([]);
    expect(defaultHostIds({ ownerIds: [], memberIds: members })).toEqual([]);
  });

  it("removes duplicate owners and keeps their order", () => {
    expect(defaultHostIds({ ownerIds: [ANDERS, MADS, ANDERS], memberIds: members })).toEqual([
      ANDERS,
      MADS,
    ]);
  });

  it("never gives more than MAX_EVENT_HOSTS", () => {
    const many = Array.from({ length: 25 }, (_, i) => `u${i}`);
    expect(defaultHostIds({ ownerIds: many, memberIds: new Set(many) })).toHaveLength(
      MAX_EVENT_HOSTS,
    );
  });
});

describe("resolveHostIds", () => {
  const base = {
    ownerIds: [MADS],
    memberIds: members,
    existingHostIds: [] as string[],
  };

  it("uses the place's owners for an empty request, else nobody (D-175)", () => {
    expect(resolveHostIds({ ...base, requested: [] })).toEqual({ ok: true, hostIds: [MADS] });
    expect(resolveHostIds({ ...base, ownerIds: [], requested: [] })).toEqual({
      ok: true,
      hostIds: [],
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
    expect(suggestHosts({ ownerIds: [MADS, OUTSIDER], memberIds: members })).toEqual({
      hostIds: [MADS],
      reason: "owners",
    });
  });

  it("suggests nobody when the place has no owners who are members (D-175)", () => {
    expect(suggestHosts({ ownerIds: [], memberIds: members })).toEqual({
      hostIds: [],
      reason: "none",
    });
    expect(suggestHosts({ ownerIds: [OUTSIDER], memberIds: members })).toEqual({
      hostIds: [],
      reason: "none",
    });
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
