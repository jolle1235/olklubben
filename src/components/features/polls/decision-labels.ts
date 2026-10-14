import { capitalize } from "@/components/features/calendar/event-format";
import { formatLongDate, formatShortDate, formatTime, formatWeekdayShort } from "@/lib/format/date";
import { formatDanishList } from "@/lib/format/list";
import { TIE_CHOICE_MESSAGES, tieChoiceSchema } from "@/lib/validation/poll";
import type { PollCategory } from "@/server/domain/polls/options";

import { timeLeftLabel, votedSummaryLabel } from "./poll-labels";

/**
 * Danish texts for the end of a poll (SPEC §9.7.4–§9.7.7, D-008, D-137):
 * the confirmations for "Afslut nu" and "Annullér", the tie card, the outcome
 * card, the cancelled banner and the Overblik PollCard. Pure and client-safe
 * (the TieResolver and the confirm buttons are Client Components); times are
 * always Europe/Copenhagen (src/lib/format/date.ts). Pass the request's `now`.
 */

// ── Confirmations ───────────────────────────────────────────────────────────

export type ConfirmCopy = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  pendingLabel: string;
};

/** "Afslut afstemningen nu?" with how many have voted (§9.7.5 "Manuelt"). */
export function closeConfirmCopy(votedCount: number, memberCount: number): ConfirmCopy {
  return {
    title: "Afslut afstemningen nu?",
    description:
      `${votedSummaryLabel(votedCount, memberCount)}. Stemmerne tælles op nu, og ingen kan ` +
      "stemme bagefter. Er der en klar vinder, bliver eventet oprettet med det samme.",
    confirmLabel: "Afslut nu",
    cancelLabel: "Fortsæt afstemningen",
    pendingLabel: "Afslutter …",
  };
}

/** "Annullér «Ølsmagning #15»?" (§9.7.4: no event, the votes stay visible). */
export function cancelConfirmCopy(title: string): ConfirmCopy {
  return {
    title: `Annullér «${title}»?`,
    description: "Der bliver ikke oprettet et event. Stemmerne bliver stående, så I kan se dem.",
    confirmLabel: "Annullér afstemning",
    cancelLabel: "Behold den",
    pendingLabel: "Annullerer …",
  };
}

// ── Who decides ─────────────────────────────────────────────────────────────

type Creator = { name: string; isMember: boolean };

/**
 * For members who cannot manage the poll: "Mads (opretteren) og klubbens
 * admins kan afslutte eller annullere afstemningen." A creator who has left
 * no longer can (E11): "Klubbens admins kan …".
 */
export function managersNote(creator: Creator): string {
  return creator.isMember
    ? `${creator.name} (opretteren) og klubbens admins kan afslutte eller annullere afstemningen.`
    : "Klubbens admins kan afslutte eller annullere afstemningen.";
}

/** The tie card for members who cannot choose: "Mads eller en admin vælger vinderen." (E11). */
export function tieWaitingNote(creator: Creator): string {
  return creator.isMember
    ? `${creator.name} eller en admin vælger vinderen.`
    : "En admin vælger vinderen.";
}

// ── The tie card ────────────────────────────────────────────────────────────

/** E9: the deadline passed with no ballots at all. */
export const NO_VOTES_NOTE = "Ingen nåede at stemme 🦗";

/** A tied (or decided) date can lie in the past: the event is then history (E33). */
export const PAST_DATE_HINT =
  "Datoen er overstået – eventet bliver oprettet som en tidligere smagning.";
export const PAST_TIED_DATE_HINT =
  "En af datoerne er overstået. Vælger du den, bliver eventet oprettet som en tidligere smagning.";

/** The radio group's legend in the TieResolver. */
export function tieChoiceLegend(category: PollCategory): string {
  return category === "DATE" ? "Hvilken dato bliver det?" : "Hvilket sted bliver det?";
}

/** "5 kan" (dates: approval votes) · "4 stemmer" / "1 stemme" (places). */
export function optionCountLabel(category: PollCategory, count: number): string {
  if (category === "DATE") return `${count} kan`;
  return count === 1 ? "1 stemme" : `${count} stemmer`;
}

/** "Hos Mads 4 · Hos Jesper 4": the tied options for members who wait. */
export function tiedOptionsLabel(options: readonly { label: string; count: number }[]): string {
  return options.map((option) => `${option.label} ${option.count}`).join(" · ");
}

/**
 * The category that is NOT tied: "Datoen er afgjort: lørdag 21. november kl.
 * 18:30 (5 kan)" / "Stedet er afgjort: Hos Mads (4 stemmer)", or for a single
 * option "Stedet ligger fast: Hos Mads".
 */
export function decidedCategoryLabel(input: {
  category: PollCategory;
  label: string;
  /** null: the category had one option (fixed). */
  count: number | null;
}): string {
  const subject = input.category === "DATE" ? "Datoen" : "Stedet";
  return input.count === null
    ? `${subject} ligger fast: ${input.label}`
    : `${subject} er afgjort: ${input.label} (${optionCountLabel(input.category, input.count)})`;
}

/**
 * The browser's check for the TieResolver: every tied category needs a choice
 * (the server answers the same with invalid-choice). Built on the shared
 * tieChoiceSchema, so a malformed id gets the same message as on the server.
 */
export function tieChoiceFormSchema(tied: readonly PollCategory[]) {
  return tieChoiceSchema.superRefine((resolutions, context) => {
    for (const category of tied) {
      if (resolutions[category]) continue;
      context.addIssue({
        code: "custom",
        message: TIE_CHOICE_MESSAGES[category],
        path: [category === "DATE" ? "dateOptionId" : "placeOptionId"],
      });
    }
  });
}

// ── The outcome ─────────────────────────────────────────────────────────────

/** "Lørdag 21. november · 18:30" (+ the year outside the current one). */
export function outcomeDateLabel(startsAt: Date, now: Date): string {
  return `${capitalize(formatLongDate(startsAt, now))} · ${formatTime(startsAt)}`;
}

/** "Vært: Mads" · "Værter: Mads og Anders" · "Ingen vært endnu" (E34: nobody could be chosen). */
export function hostsLabel(names: readonly string[]): string {
  if (names.length === 0) return "Ingen vært endnu";
  return `${names.length === 1 ? "Vært" : "Værter"}: ${formatDanishList(names)}`;
}

/**
 * Who chose after a tie: "Mads valgte stedet, da det stod lige." · "Mads
 * valgte datoen og stedet, da de stod lige." ("" without a tie). Grouped by
 * person, in the order given (DATE first).
 */
export function resolvedByLabel(
  resolutions: readonly { category: PollCategory; chosenByName: string }[],
): string {
  const byPerson = new Map<string, PollCategory[]>();
  for (const resolution of resolutions) {
    const list = byPerson.get(resolution.chosenByName) ?? [];
    list.push(resolution.category);
    byPerson.set(resolution.chosenByName, list);
  }
  return [...byPerson.entries()]
    .map(([name, categories]) => {
      const both = categories.includes("DATE") && categories.includes("PLACE");
      if (both) return `${name} valgte datoen og stedet, da de stod lige.`;
      return categories[0] === "DATE"
        ? `${name} valgte datoen, da den stod lige.`
        : `${name} valgte stedet, da det stod lige.`;
    })
    .join(" ");
}

/** The event the poll created has been deleted (§9.7.7: it is an ordinary event). */
export const EVENT_DELETED_NOTE = "Eventet fra afstemningen er slettet.";

/** "Annulleret af Mads lørdag 7. november. Der blev ikke oprettet et event." */
export function cancelledLabel(cancelledByName: string, cancelledAt: Date, now: Date): string {
  return `Annulleret af ${cancelledByName} ${formatLongDate(cancelledAt, now)}. Der blev ikke oprettet et event.`;
}

// ── The Overblik card ───────────────────────────────────────────────────────

export type PollCardState = "missing" | "voted" | "tie-manager" | "tie-waiting" | "decided";

/** Which of the five PollCard states (D-137) a poll is in for this viewer. */
export function pollCardState(
  poll: { status: "OPEN" | "AWAITING_DECISION" | "CLOSED"; viewerHasVoted: boolean },
  canManage: boolean,
): PollCardState {
  switch (poll.status) {
    case "OPEN":
      return poll.viewerHasVoted ? "voted" : "missing";
    case "AWAITING_DECISION":
      return canManage ? "tie-manager" : "tie-waiting";
    case "CLOSED":
      return "decided";
  }
}

/** The card's bold line. */
export function pollCardHeadline(
  state: PollCardState,
  creator: Creator,
  decided: { startsAt: Date; placeName: string } | null,
  now: Date,
): string {
  switch (state) {
    case "missing":
      return "Du mangler at stemme";
    case "voted":
      return "Du har stemt ✓";
    case "tie-manager":
      return "Uafgjort 🤝 – du skal vælge vinderen";
    case "tie-waiting":
      return creator.isMember
        ? `Uafgjort 🤝 – ${creator.name} eller en admin vælger`
        : "Uafgjort 🤝 – en admin vælger";
    case "decided":
      return decided
        ? `🎉 Afgjort: ${formatLongDate(decided.startsAt, now)} · ${decided.placeName}`
        : "🎉 Afgjort";
  }
}

/** "Frist om 2 dage · 5 af 8 har stemt" (OPEN). */
export function pollCardMeta(
  poll: { deadline: Date; votedCount: number; memberCount: number },
  now: Date,
): string {
  return `${timeLeftLabel(poll.deadline, now)} · ${votedSummaryLabel(poll.votedCount, poll.memberCount)}`;
}

/**
 * "Fører lige nu: lør 21/11 · Hos Mads" while OPEN; "Står lige lige nu" when a
 * category is tied (leader null).
 */
export function leaderLabel(
  leader: { startsAt: Date | null; placeName: string | null } | null,
): string {
  if (!leader) return "Står lige lige nu";
  const parts = [
    leader.startsAt
      ? `${formatWeekdayShort(leader.startsAt)} ${formatShortDate(leader.startsAt)}`
      : null,
    leader.placeName,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? `Fører lige nu: ${parts.join(" · ")}` : "Står lige lige nu";
}
