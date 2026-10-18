import { firstParam, type SearchParamValue } from "@/lib/search-params";
import { stripNul } from "@/lib/text";

import { toFeedbackPagePath } from "./page-path";
import type { FeedbackType } from "./status";

/**
 * The prefill of "Ny rapport" (SPEC §9.9, D-143):
 *
 *   /feedback/new?type=bug|feature&page=%2Fcalendar
 *
 *   * type – "bug" or "feature", any case. Missing or unknown → BUG (the
 *            §9.9 sketch has Fejl selected; "Rapportér denne fejl" sends bug).
 *   * page – the page the user came from, through toFeedbackPagePath, so a
 *            club id, a query, a hash or an invitation code typed into the URL
 *            never reaches the form. Not a path → "" (no page).
 *
 * Values are untrusted (string, string[] or undefined) and only read as
 * strings, NUL stripped and length capped first (D-090). Never throws. Pure
 * module: client-safe.
 */

export type NewFeedbackParams = {
  type: FeedbackType;
  /** "" when there is no (valid) page. */
  page: string;
};

/** "feature" is the longest valid value; anything much longer is not one. */
const RAW_TYPE_MAX_LENGTH = 20;

export function parseNewFeedbackParams(
  searchParams: Record<string, SearchParamValue>,
): NewFeedbackParams {
  const rawType = firstParam(searchParams.type);
  const type =
    typeof rawType === "string" && rawType.length <= RAW_TYPE_MAX_LENGTH
      ? stripNul(rawType).trim().toLowerCase()
      : "";
  return {
    type: type === "feature" ? "FEATURE" : "BUG",
    page: toFeedbackPagePath(firstParam(searchParams.page)) ?? "",
  };
}
