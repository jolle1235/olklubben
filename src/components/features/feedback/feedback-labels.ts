import { feedbackListHref } from "@/lib/routes";
import type {
  FeedbackListParams,
  FeedbackSort,
  FeedbackTypeFilter,
} from "@/server/domain/feedback/list-params";
import type { FeedbackStatusFilter, FeedbackType } from "@/server/domain/feedback/status";

/**
 * Texts and links of the feedback pages (SPEC §9.9, §13.5), kept out of the
 * components so they can be unit tested. Pure and client-safe.
 */

// ── The list's filters ──────────────────────────────────────────────────────

/** One filter link ("chip"). `current`: the list shows this choice now. */
export type FeedbackFilterChip = { key: string; label: string; href: string; current: boolean };

export type FeedbackFilterGroups = {
  type: FeedbackFilterChip[];
  status: FeedbackFilterChip[];
  /** "Mine rapporter": a toggle, so its link turns the filter off again while it is on. */
  mine: FeedbackFilterChip;
  sort: FeedbackFilterChip[];
};

const TYPE_CHIPS: readonly { value: FeedbackTypeFilter; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "bug", label: "🐞 Fejl" },
  { value: "feature", label: "💡 Ønsker" },
];

const STATUS_CHIPS: readonly { value: FeedbackStatusFilter; label: string }[] = [
  { value: "open", label: "Åbne" },
  { value: "closed", label: "Lukkede" },
  { value: "all", label: "Alle" },
];

const SORT_CHIPS: readonly { value: FeedbackSort; label: string }[] = [
  { value: "votes", label: "Flest stemmer" },
  { value: "newest", label: "Nyeste" },
];

/**
 * The list's filter links (/feedback?type=…&status=…&mine=1&sort=…): each
 * keeps the other choices and leaves the defaults out (feedbackListHref). Plain
 * links, so the filters work without JavaScript and every view can be shared.
 */
export function feedbackFilterGroups(params: FeedbackListParams): FeedbackFilterGroups {
  return {
    type: TYPE_CHIPS.map(({ value, label }) => ({
      key: `type-${value}`,
      label,
      href: feedbackListHref({ ...params, type: value }),
      current: params.type === value,
    })),
    status: STATUS_CHIPS.map(({ value, label }) => ({
      key: `status-${value}`,
      label,
      href: feedbackListHref({ ...params, status: value }),
      current: params.status === value,
    })),
    mine: {
      key: "mine",
      label: "Mine rapporter",
      href: feedbackListHref({ ...params, mine: !params.mine }),
      current: params.mine,
    },
    sort: SORT_CHIPS.map(({ value, label }) => ({
      key: `sort-${value}`,
      label,
      href: feedbackListHref({ ...params, sort: value }),
      current: params.sort === value,
    })),
  };
}

// ── The list's empty states ─────────────────────────────────────────────────

export type FeedbackEmptyState = {
  title: string;
  description: string;
  /** "Vis alle mine rapporter": the viewer has reports, just not under these filters. */
  allMineHref?: string;
};

const NOUN: Record<FeedbackTypeFilter, string> = {
  all: "rapporter",
  bug: "fejl",
  feature: "ønsker",
};

const INVITE = "Har du fundet en fejl eller fået en idé, så skriv den.";

/**
 * What an empty list says (SPEC §13.5). With "Mine rapporter" it depends on
 * whether the viewer has sent any report at all (`hasOwnReports`).
 */
export function feedbackEmptyState(
  params: FeedbackListParams,
  { hasOwnReports }: { hasOwnReports: boolean },
): FeedbackEmptyState {
  const noun = NOUN[params.type];
  if (params.mine) {
    if (!hasOwnReports) {
      return {
        title: "Du har ikke sendt nogen rapporter endnu.",
        description: `${INVITE} Alle brugere af appen kan se den.`,
      };
    }
    return {
      title: `Du har ingen ${params.status === "all" ? "" : `${statusWord(params.status)} `}${noun} her.`,
      description: "Dine andre rapporter står under de andre filtre.",
      allMineHref: feedbackListHref({ mine: true, status: "all" }),
    };
  }
  switch (params.status) {
    case "open":
      return {
        title: `Ingen åbne ${noun}. Skål!`,
        description: `Alt kører, som det skal. ${INVITE}`,
      };
    case "closed":
      return {
        title: `Ingen lukkede ${noun} endnu.`,
        description: "Her lander rapporterne, når de er færdige, afviste eller dubletter.",
      };
    case "all":
      return { title: `Ingen ${noun} endnu.`, description: INVITE };
  }
}

function statusWord(status: Exclude<FeedbackStatusFilter, "all">): string {
  return status === "open" ? "åbne" : "lukkede";
}

// ── The form, the 👍 and the technical info ─────────────────────────────────

/** The description's placeholder guides by type (SPEC §9.9). */
export const FEEDBACK_DESCRIPTION_PLACEHOLDERS: Record<FeedbackType, string> = {
  BUG: "Hvad skete der? Hvad forventede du? Hvordan kan vi gentage fejlen?",
  FEATURE: "Hvad vil du gerne kunne, og hvorfor?",
};

/**
 * The 👍 button says what it does (D-115: no aria-pressed): "👍 Jeg har også
 * det problem" (Fejl) / "👍 Det vil jeg også gerne have" (Idé), and "Fjern
 * min 👍" once given.
 */
export function feedbackVoteLabel(type: FeedbackType, voted: boolean): string {
  if (voted) return "Fjern min 👍";
  return type === "BUG" ? "👍 Jeg har også det problem" : "👍 Det vil jeg også gerne have";
}

/**
 * "stemme" / "stemmer": read after a 👍 count, whose emoji is aria-hidden
 * (`<span aria-hidden>👍 </span>3<span class="sr-only"> stemmer</span>`).
 */
export function voteNoun(count: number): string {
  return count === 1 ? "stemme" : "stemmer";
}

/** "390 px" with a no-break space, or null when the width is unknown. */
export function formatViewportWidth(width: number | null): string | null {
  return width === null ? null : `${width} px`;
}
