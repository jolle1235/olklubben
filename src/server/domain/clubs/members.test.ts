import { describe, expect, it } from "vitest";

import { compareMembers, memberCountLabel, sortMembers, type SortableMember } from "./members";

function member(
  userId: string,
  name: string,
  role: SortableMember["role"] = "MEMBER",
  nickname?: string | null,
): SortableMember {
  return { userId, name, role, nickname };
}

describe("sortMembers", () => {
  it("puts admins first, then sorts by name", () => {
    const sorted = sortMembers([
      member("1", "Mads"),
      member("2", "Jesper", "ADMIN"),
      member("3", "Anders"),
      member("4", "Bo", "ADMIN"),
    ]);
    expect(sorted.map((m) => m.name)).toEqual(["Bo", "Jesper", "Anders", "Mads"]);
  });

  it("sorts the Danish way: Æ, Ø and Å after Z", () => {
    const sorted = sortMembers([
      member("1", "Åge"),
      member("2", "Øjvind"),
      member("3", "Ærling"),
      member("4", "Zakarias"),
      member("5", "Anne"),
    ]);
    expect(sorted.map((m) => m.name)).toEqual(["Anne", "Zakarias", "Ærling", "Øjvind", "Åge"]);
  });

  it("ignores case when sorting", () => {
    const sorted = sortMembers([member("1", "bo"), member("2", "Anders"), member("3", "carl")]);
    expect(sorted.map((m) => m.name)).toEqual(["Anders", "bo", "carl"]);
  });

  it("sorts by the display name (nickname wins over name)", () => {
    const sorted = sortMembers([
      member("1", "Anders"),
      member("2", "Zeus Hansen", "MEMBER", "Bjørnen"),
    ]);
    expect(sorted.map((m) => m.userId)).toEqual(["1", "2"]);
    expect(
      sortMembers([member("1", "Carl"), member("2", "Zeus", "MEMBER", "Bamse")]).map(
        (m) => m.userId,
      ),
    ).toEqual(["2", "1"]);
  });

  it("is stable for equal names (falls back to user id)", () => {
    const a = member("b", "Mads");
    const b = member("a", "Mads");
    expect(sortMembers([a, b]).map((m) => m.userId)).toEqual(["a", "b"]);
    expect(compareMembers(a, a)).toBe(0);
  });

  it("does not change the input array", () => {
    const input = [member("1", "Mads"), member("2", "Anders")];
    sortMembers(input);
    expect(input.map((m) => m.name)).toEqual(["Mads", "Anders"]);
  });

  it("keeps extra fields", () => {
    const sorted = sortMembers([{ ...member("1", "Mads"), joinedAt: new Date(0) }]);
    expect(sorted[0]?.joinedAt).toEqual(new Date(0));
  });
});

describe("memberCountLabel", () => {
  it("uses singular for one member and plural otherwise", () => {
    expect(memberCountLabel(1)).toBe("1 medlem");
    expect(memberCountLabel(0)).toBe("0 medlemmer");
    expect(memberCountLabel(8)).toBe("8 medlemmer");
  });
});
