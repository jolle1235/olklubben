/**
 * Search params from a page's `searchParams` (untrusted): a key may be
 * missing, given once or repeated (?a=1&a=2).
 *
 * Pure and client-safe.
 */

export type SearchParamValue = string | string[] | undefined;

/** The first value of a search param (?a=1&a=2 → "1"). */
export function firstParam(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
