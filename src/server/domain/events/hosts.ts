/**
 * Event hosts (SPEC §9.2 "Værter", D-098).
 *
 *   * The form sends the chosen hosts. EMPTY means "the default": the place's
 *     owners who are members, else the creator (on edit: the event's creator,
 *     else the editor).
 *   * Chosen hosts must be current members. A host who has left may stay on an
 *     event they already host (history, §7.4), but cannot be added again.
 *   * At most MAX_EVENT_HOSTS.
 *
 * The server decides with resolveHostIds under row locks
 * (src/server/events/mutations.ts); the form's picker uses suggestHosts for
 * its pre-filled chips and hint.
 *
 * Pure module: no Next.js, React or database imports. Client-safe.
 */

export const MAX_EVENT_HOSTS = 20;

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

/**
 * The hosts an event gets when the form sends none: the place's owners who are
 * members (input order, no duplicates, at most MAX_EVENT_HOSTS), else the first
 * fallback user who is a member, else nobody.
 */
export function defaultHostIds(input: {
  ownerIds: readonly string[];
  fallbackUserIds: readonly string[];
  memberIds: ReadonlySet<string>;
}): string[] {
  const owners = unique(input.ownerIds).filter((id) => input.memberIds.has(id));
  if (owners.length > 0) return owners.slice(0, MAX_EVENT_HOSTS);
  const fallback = input.fallbackUserIds.find((id) => input.memberIds.has(id));
  return fallback === undefined ? [] : [fallback];
}

export type ResolvedHosts = { ok: true; hostIds: string[] } | { ok: false; userIds: string[] };

/**
 * The hosts to store. `requested` (deduplicated) wins when it is not empty;
 * every id must then be a member or already a host of the event
 * (`existingHostIds`), otherwise the offenders are returned. Empty →
 * defaultHostIds.
 */
export function resolveHostIds(input: {
  requested: readonly string[];
  ownerIds: readonly string[];
  fallbackUserIds: readonly string[];
  memberIds: ReadonlySet<string>;
  existingHostIds: readonly string[];
}): ResolvedHosts {
  const requested = unique(input.requested);
  if (requested.length === 0) {
    return { ok: true, hostIds: defaultHostIds(input) };
  }
  const existing = new Set(input.existingHostIds);
  const invalid = requested.filter((id) => !input.memberIds.has(id) && !existing.has(id));
  return invalid.length > 0 ? { ok: false, userIds: invalid } : { ok: true, hostIds: requested };
}

export type HostSuggestion = {
  hostIds: string[];
  /** "owners": the place's owners. "fallback": the place has none, so the user. */
  reason: "owners" | "fallback";
};

/**
 * The picker's suggestion for a place (the same rule as defaultHostIds): its
 * owners who are members, else the user filling in the form.
 */
export function suggestHosts(input: {
  ownerIds: readonly string[];
  memberIds: ReadonlySet<string>;
  fallbackUserId: string;
}): HostSuggestion {
  const owners = defaultHostIds({
    ownerIds: input.ownerIds,
    fallbackUserIds: [],
    memberIds: input.memberIds,
  });
  if (owners.length > 0) return { hostIds: owners, reason: "owners" };
  return {
    hostIds: input.memberIds.has(input.fallbackUserId) ? [input.fallbackUserId] : [],
    reason: "fallback",
  };
}

/** True when both lists hold the same ids (order and duplicates ignored). */
export function sameIdSet(a: readonly string[], b: readonly string[]): boolean {
  const setA = new Set(a);
  const setB = new Set(b);
  return setA.size === setB.size && [...setA].every((id) => setB.has(id));
}
