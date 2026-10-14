import {
  formatShortDate,
  formatTime,
  formatWeekday,
  formatWeekdayDateTime,
} from "@/lib/format/date";
import { getDisplayName, type DisplayNameUser } from "@/lib/format/display-name";
import { formatDanishList } from "@/lib/format/list";
import type { PollCategory, PollCloseReason, PollStatus } from "@/server/domain/polls/options";
import { timeLeft } from "@/server/domain/polls/schedule";

/**
 * Danish texts for polls (SPEC §9.7, §13.5; D-135–D-137), shared by the poll
 * page, Overblik and Kalender. Pure and client-safe; times are always shown in
 * Europe/Copenhagen (src/lib/format/date.ts). Pass the request's `now` down
 * (never `new Date()` during a client render).
 */

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/**
 * "Frist om 3 dage, 4 timer" · "Frist om 1 dag" · "Frist om 5 timer" ·
 * "Frist om 1 time" · "Frist om 12 minutter" · "Frist om under et minut" ·
 * "Fristen er udløbet". Elapsed time, so it is right across DST.
 */
export function timeLeftLabel(deadline: Date, now: Date): string {
  const left = timeLeft(deadline, now);
  switch (left.kind) {
    case "days":
      return left.hours > 0
        ? `Frist om ${plural(left.days, "dag", "dage")}, ${plural(left.hours, "time", "timer")}`
        : `Frist om ${plural(left.days, "dag", "dage")}`;
    case "hours":
      return `Frist om ${plural(left.hours, "time", "timer")}`;
    case "minutes":
      return left.minutes === 0
        ? "Frist om under et minut"
        : `Frist om ${plural(left.minutes, "minut", "minutter")}`;
    case "passed":
      return "Fristen er udløbet";
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase("da") + text.slice(1);
}

/** "Lørdag 14/11 · 18:30": a date option in a list (§9.7.3). */
export function pollDateLabel(startsAt: Date): string {
  return `${capitalize(formatWeekday(startsAt))} ${formatShortDate(startsAt)} · ${formatTime(startsAt)}`;
}

/** "lørdag 14. november kl. 18:30": screen readers, confirmations, running text. */
export function pollDateLongLabel(startsAt: Date): string {
  return formatWeekdayDateTime(startsAt);
}

/** "6 af 8 har stemt". */
export function votedSummaryLabel(voted: number, total: number): string {
  return `${voted} af ${total} har stemt`;
}

/**
 * "Mangler: Anders, Bo og dig" (display names in the given order, the viewer
 * last as "dig"). "" when nobody is missing.
 */
export function missingLabel(
  people: readonly (DisplayNameUser & { id: string })[],
  viewerId: string,
): string {
  if (people.length === 0) return "";
  const others = people.filter((person) => person.id !== viewerId).map((p) => getDisplayName(p));
  const names = people.some((person) => person.id === viewerId) ? [...others, "dig"] : others;
  return `Mangler: ${formatDanishList(names)}`;
}

/** "Der er uafgjort om stedet 🤝" · "… om datoen 🤝" · "… om både datoen og stedet 🤝". */
export function tieHeadline(categories: readonly PollCategory[]): string {
  const date = categories.includes("DATE");
  const place = categories.includes("PLACE");
  if (date && place) return "Der er uafgjort om både datoen og stedet 🤝";
  if (date) return "Der er uafgjort om datoen 🤝";
  return "Der er uafgjort om stedet 🤝";
}

/**
 * Why voting ended: "Alle havde stemt." · "Fristen udløb tirsdag 10. november
 * kl. 20:00." · "Afsluttet af Mads." ("" before it ended).
 */
export function closeReasonLabel(view: {
  closeReason: PollCloseReason | null;
  deadline: Date;
  closedBy: DisplayNameUser | null;
}): string {
  switch (view.closeReason) {
    case "ALL_VOTED":
      return "Alle havde stemt.";
    case "DEADLINE":
      return `Fristen udløb ${formatWeekdayDateTime(view.deadline)}.`;
    case "MANUAL":
      return `Afsluttet af ${getDisplayName(view.closedBy)}.`;
    case null:
      return "";
  }
}

/** The status badge: "Åben" · "Uafgjort 🤝" · "Afgjort" · "Annulleret". */
export function pollStatusLabel(status: PollStatus): string {
  switch (status) {
    case "OPEN":
      return "Åben";
    case "AWAITING_DECISION":
      return "Uafgjort 🤝";
    case "CLOSED":
      return "Afgjort";
    case "CANCELLED":
      return "Annulleret";
  }
}
