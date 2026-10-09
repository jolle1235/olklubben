import { describe, expect, it } from "vitest";

import { afterAuthPath, firstParam, isInvitePath, readNextParam, withNext } from "./auth-links";

describe("firstParam", () => {
  it("tager den første værdi", () => {
    expect(firstParam("/clubs")).toBe("/clubs");
    expect(firstParam(["/a", "/b"])).toBe("/a");
    expect(firstParam(undefined)).toBeUndefined();
    expect(firstParam([])).toBeUndefined();
  });
});

describe("readNextParam", () => {
  it("accepterer en sti på samme site", () => {
    expect(readNextParam("/join/K7XMQ2PA")).toBe("/join/K7XMQ2PA");
    expect(readNextParam(["/clubs?fra=test", "/x"])).toBe("/clubs?fra=test");
  });

  it("afviser alt, der kan føre til et andet site", () => {
    for (const value of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "",
    ]) {
      expect(readNextParam(value)).toBeNull();
    }
    expect(readNextParam(undefined)).toBeNull();
  });
});

describe("afterAuthPath", () => {
  it("bruger next, når den er sikker, ellers forsiden", () => {
    expect(afterAuthPath("/join/K7XMQ2PA")).toBe("/join/K7XMQ2PA");
    expect(afterAuthPath("https://evil.example")).toBe("/");
    expect(afterAuthPath(null)).toBe("/");
    expect(afterAuthPath(undefined)).toBe("/");
  });
});

describe("withNext", () => {
  it("bærer next med mellem login, opret og glemt password", () => {
    expect(withNext("/signup", "/join/K7XMQ2PA")).toBe("/signup?next=%2Fjoin%2FK7XMQ2PA");
    expect(withNext("/login", "/clubs?fra=test")).toBe("/login?next=%2Fclubs%3Ffra%3Dtest");
  });

  it("tilføjer med & når stien allerede har en query", () => {
    expect(withNext("/login?reset=1", "/clubs")).toBe("/login?reset=1&next=%2Fclubs");
  });

  it("udelader next, når den mangler eller er usikker", () => {
    expect(withNext("/signup", null)).toBe("/signup");
    expect(withNext("/signup", undefined)).toBe("/signup");
    expect(withNext("/signup", "//evil.example")).toBe("/signup");
  });
});

describe("isInvitePath", () => {
  it("genkender invitationslinks", () => {
    expect(isInvitePath("/join/K7XMQ2PA")).toBe(true);
    expect(isInvitePath("/join/K7XMQ2PA?x=1")).toBe(true);
  });

  it("ignorerer andre stier", () => {
    expect(isInvitePath("/join")).toBe(false);
    expect(isInvitePath("/join/")).toBe(false);
    expect(isInvitePath("/clubs")).toBe(false);
    expect(isInvitePath(null)).toBe(false);
  });
});
