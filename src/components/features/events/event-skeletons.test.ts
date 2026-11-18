import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EventInvitation } from "./event-invitation";
import { EventDetailSkeleton } from "./event-skeletons";

const invitation = renderToStaticMarkup(
  createElement(EventInvitation, {
    clubId: "c",
    event: {
      title: "Ølsmagning",
      theme: "Tyske øl",
      place: { id: "p", name: "Hos Mads", address: null, archived: false },
      startsAt: new Date("2026-11-21T17:30:00Z"),
      endsAt: null,
      hasStartTime: true,
    },
    hosts: [],
    creatorName: "Mads",
    now: new Date("2026-11-18T12:00:00Z"),
  }),
);
const skeleton = renderToStaticMarkup(createElement(EventDetailSkeleton));

/** The classes that decide the card's size: padding and the dividers' margins. */
const cardClasses = (html: string, tag: string) =>
  (new RegExp(`<${tag} class="([^"]*rounded-3xl[^"]*)"`).exec(html)?.[1] ?? "")
    .split(" ")
    .filter((c) => /^(sm:|md:)?p[xytb]-/.test(c))
    .sort();
const dividerMargins = (html: string) => html.match(/(?<![\w-])(?:md:)?my-\d+/g) ?? [];

// SPEC §13.4.7: the skeleton has the content's shape, so nothing jumps (D-181).
describe("EventDetailSkeleton", () => {
  it("has the event card's padding", () => {
    expect(cardClasses(skeleton, "div")).toEqual(cardClasses(invitation, "article"));
  });

  it("has the event card's divider margins", () => {
    expect(dividerMargins(skeleton)).toEqual(dividerMargins(invitation));
  });

  it("has no placeholder for the removed anchor icon", () => {
    expect(skeleton).not.toContain("size-12 rounded-full");
  });
});
