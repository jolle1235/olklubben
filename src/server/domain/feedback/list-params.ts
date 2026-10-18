import { firstParam, type SearchParamValue } from "@/lib/search-params";

import type { FeedbackStatusFilter } from "./status";

/**
 * The feedback list's URL state (SPEC §9.9 "Oversigt"):
 *
 *   /feedback?type=bug|feature&status=closed|all&mine=1&sort=newest
 *
 *   * type   – "all" (default), "bug" or "feature".
 *   * status – "open" (default: Ny, Planlagt, I gang), "closed" (Færdig, Afvist,
 *              Dublet, D-144) or "all".
 *   * mine   – "1": only the viewer's own reports ("Mine rapporter").
 *   * sort   – "votes" (default: flest 👍) or "newest".
 *
 * Values are untrusted (string, string[] or undefined): unknown values fall
 * back to the default and nothing ever throws. Links leave the defaults out,
 * so "/feedback" is the default list. Pure module: client-safe.
 */

export type FeedbackTypeFilter = "all" | "bug" | "feature";
export type FeedbackSort = "votes" | "newest";

export type FeedbackListParams = {
  type: FeedbackTypeFilter;
  status: FeedbackStatusFilter;
  mine: boolean;
  sort: FeedbackSort;
};

export const DEFAULT_FEEDBACK_LIST_PARAMS: FeedbackListParams = {
  type: "all",
  status: "open",
  mine: false,
  sort: "votes",
};

const TYPE_FILTERS: readonly FeedbackTypeFilter[] = ["all", "bug", "feature"];
const STATUS_FILTERS: readonly FeedbackStatusFilter[] = ["open", "closed", "all"];
const SORTS: readonly FeedbackSort[] = ["votes", "newest"];

function oneOf<T extends string>(value: SearchParamValue, allowed: readonly T[], fallback: T): T {
  const first = firstParam(value);
  return (allowed as readonly string[]).includes(first ?? "") ? (first as T) : fallback;
}

export function parseFeedbackListParams(
  searchParams: Record<string, SearchParamValue>,
): FeedbackListParams {
  const defaults = DEFAULT_FEEDBACK_LIST_PARAMS;
  return {
    type: oneOf(searchParams.type, TYPE_FILTERS, defaults.type),
    status: oneOf(searchParams.status, STATUS_FILTERS, defaults.status),
    mine: firstParam(searchParams.mine) === "1",
    sort: oneOf(searchParams.sort, SORTS, defaults.sort),
  };
}

/** "?type=bug&mine=1" for the given choices (defaults left out), or "" for the default list. */
export function feedbackListSearch(params: Partial<FeedbackListParams> = {}): string {
  const { type, status, mine, sort } = { ...DEFAULT_FEEDBACK_LIST_PARAMS, ...params };
  const defaults = DEFAULT_FEEDBACK_LIST_PARAMS;
  const query = new URLSearchParams();
  if (type !== defaults.type) query.set("type", type);
  if (status !== defaults.status) query.set("status", status);
  if (mine) query.set("mine", "1");
  if (sort !== defaults.sort) query.set("sort", sort);
  const search = query.toString();
  return search ? `?${search}` : "";
}
