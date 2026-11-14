/**
 * The seeded data a verify instance starts with: `prisma/seed.ts`, run against
 * the instance's own database by `npm run verify:up`. Ids and names are fixed,
 * so a check script can link straight to a page and assert on what it shows.
 * Event and poll dates are relative to the day the instance was started.
 *
 * Mirrors the seed (README "Testbrugere" has the full tables). `verify:smoke`
 * fails when the two drift apart.
 */

export const SEED_PASSWORD = "olklubben123";

export const USERS = {
  /** Shown as "Kaptajnen". Admin in Drengene & Bajere, member of Torsdagsklubben, app-admin. */
  jesper: { email: "jesper@example.com", name: "Jesper Thomsen", nickname: "Kaptajnen" },
  /** Member of Drengene & Bajere, admin of Torsdagsklubben. Lands on /clubs. */
  mads: { email: "mads@example.com", name: "Mads", nickname: null },
  /** Member of Drengene & Bajere only. */
  anders: { email: "anders@example.com", name: "Anders", nickname: null },
} as const;

export type SeedUser = keyof typeof USERS;

export const CLUBS = {
  drengene: { id: "5eed0000-0000-7000-8000-0000000000c1", name: "Drengene & Bajere" },
  torsdag: { id: "5eed0000-0000-7000-8000-0000000000c2", name: "Torsdagsklubben" },
} as const;

export const EVENTS = {
  /** Drengene & Bajere, 3 weeks ago, Hos Mads, has four beers. */
  past12: { id: "5eed0000-0000-7000-8000-0000000000e1", title: "Ølsmagning #12" },
  /** Drengene & Bajere, in 3 days, Hos Jesper, created by the closed poll. */
  next13: { id: "5eed0000-0000-7000-8000-0000000000e2", title: "Ølsmagning #13" },
  /** Drengene & Bajere, in 4 weeks, Hos Anders. */
  juleoel: { id: "5eed0000-0000-7000-8000-0000000000e3", title: "Juleøl warmup" },
  /** Torsdagsklubben, in 1 week. */
  torsdagsoel: { id: "5eed0000-0000-7000-8000-0000000000e4", title: "Torsdagsøl" },
} as const;

export const BEERS = {
  /** Ølsmagning #12, 9,5 %, rated by all three. */
  westmalle: { id: "5eed0000-0000-7000-8000-0000000000b3", name: "Westmalle Tripel" },
  /** No event, no ratings. */
  mikkeller: { id: "5eed0000-0000-7000-8000-0000000000b6", name: "Mikkeller Beer Geek Breakfast" },
} as const;

export const POLLS = {
  /** Drengene & Bajere, open: Mads and Anders voted, Jesper has not. */
  open: { id: "5eed0000-0000-7000-8000-0000000001a1", title: "Ølsmagning #14" },
  /** Torsdagsklubben, tie on the place; Mads (admin) picks the winner. */
  tie: { id: "5eed0000-0000-7000-8000-0000000001a2", title: "Juletorsdag" },
} as const;

/** Synthetic songs, all in Torsdagsklubben (never real lyrics, SPEC §19.1 rule 10). */
export const SONGS = {
  skaal: { id: "5eed0000-0000-7000-8000-0000000000d1", title: "Skål for kaptajnen" },
  aalborg: { id: "5eed0000-0000-7000-8000-0000000000d4", title: "Aalborg-valsen" },
} as const;

/** Pages `verify:up` opens once as Kaptajnen (and /login logged out), so `next dev` has compiled them. */
export const WARM_PATHS = [
  `/c/${CLUBS.drengene.id}`,
  `/c/${CLUBS.drengene.id}/events/${EVENTS.next13.id}`,
  `/c/${CLUBS.drengene.id}/beers`,
  `/c/${CLUBS.drengene.id}/beers/${BEERS.westmalle.id}`,
  `/c/${CLUBS.drengene.id}/polls/${POLLS.open.id}`,
  `/c/${CLUBS.torsdag.id}/songs`,
  `/c/${CLUBS.torsdag.id}/songs/${SONGS.skaal.id}`,
] as const;
