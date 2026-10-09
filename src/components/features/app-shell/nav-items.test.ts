import { describe, expect, it } from "vitest";

import { getNavItems, getSidebarNav, isNavItemActive } from "./nav-items";

const items = getNavItems("club1");
const byKey = Object.fromEntries(items.map((item) => [item.key, item]));

function activeKeys(pathname: string) {
  return items.filter((item) => isNavItemActive(pathname, item)).map((item) => item.key);
}

describe("getNavItems", () => {
  it("returns the five items in SPEC §8.1 order with club-scoped hrefs", () => {
    expect(items.map((item) => [item.label, item.href])).toEqual([
      ["Overblik", "/c/club1"],
      ["Kalender", "/c/club1/calendar"],
      ["Øl", "/c/club1/beers"],
      ["Sangbog", "/c/club1/songs"],
      ["Profil", "/c/club1/profile"],
    ]);
  });

  it("encodes the club id", () => {
    expect(getNavItems("a/b")[0]?.href).toBe("/c/a%2Fb");
  });
});

describe("getSidebarNav", () => {
  const sidebar = getSidebarNav("club1");

  it("lists the four items without Profil", () => {
    expect(sidebar.list.map((item) => item.label)).toEqual([
      "Overblik",
      "Kalender",
      "Øl",
      "Sangbog",
    ]);
  });

  it("puts Profil behind the user row, with the same href and active logic", () => {
    expect(sidebar.userRow).toEqual(byKey.profile);
    expect(isNavItemActive("/c/club1/profile", sidebar.userRow)).toBe(true);
    expect(isNavItemActive("/c/club1/club", sidebar.userRow)).toBe(true);
    expect(isNavItemActive("/c/club1/places", sidebar.userRow)).toBe(true);
    expect(isNavItemActive("/c/club1", sidebar.userRow)).toBe(false);
    expect(isNavItemActive("/c/club1/beers", sidebar.userRow)).toBe(false);
  });

  it("uses the same items as the bottom nav", () => {
    expect([...sidebar.list, sidebar.userRow]).toEqual(items);
  });
});

describe("isNavItemActive", () => {
  it("marks Overblik active only on the exact club path", () => {
    expect(activeKeys("/c/club1")).toEqual(["overview"]);
    expect(activeKeys("/c/club1/")).toEqual(["overview"]);
    expect(isNavItemActive("/c/club1/events/new", byKey.overview!)).toBe(false);
  });

  it("matches the other items by prefix", () => {
    expect(activeKeys("/c/club1/calendar")).toEqual(["calendar"]);
    expect(activeKeys("/c/club1/beers/abc")).toEqual(["beers"]);
    expect(activeKeys("/c/club1/songs/new")).toEqual(["songs"]);
  });

  it("does not match a longer segment with the same start", () => {
    expect(activeKeys("/c/club1/beersx")).toEqual([]);
    expect(activeKeys("/c/club12")).toEqual([]);
  });

  it("treats event pages as part of Kalender", () => {
    expect(activeKeys("/c/club1/events/new")).toEqual(["calendar"]);
    expect(activeKeys("/c/club1/events/e1/edit")).toEqual(["calendar"]);
    expect(activeKeys("/c/club1/eventsx")).toEqual([]);
  });

  it("treats the club page as part of Profil", () => {
    expect(activeKeys("/c/club1/profile")).toEqual(["profile"]);
    expect(activeKeys("/c/club1/club")).toEqual(["profile"]);
    expect(activeKeys("/c/club1/club/edit")).toEqual(["profile"]);
  });

  it("treats the places as part of Profil (D-108)", () => {
    expect(activeKeys("/c/club1/places")).toEqual(["profile"]);
    expect(activeKeys("/c/club1/places/new")).toEqual(["profile"]);
    expect(activeKeys("/c/club1/places/p1/edit")).toEqual(["profile"]);
    expect(activeKeys("/c/club1/placesx")).toEqual([]);
  });

  it("never matches another club", () => {
    expect(activeKeys("/c/club2/beers")).toEqual([]);
  });
});
