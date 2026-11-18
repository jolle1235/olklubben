/**
 * Sidens skelet: afstandene, der gør appen tæt på mobil og luftig fra md
 * (SPEC §13.3 "Afstande"). Tailwind giver `pt-page`, `mb-header`, `gap-section`,
 * `p-card` osv. Små afstande inde i en komponent bruger Tailwinds 4 px-skala.
 */
export const spacing = {
  /** Under topbaren (main). */
  page: { base: "1rem", md: "2.5rem" },
  /** Under sidetitlen. */
  header: { base: "1rem", md: "2rem" },
  /** Mellem sektionerne på en side. */
  section: { base: "1.5rem", md: "2rem" },
  /** Overblik og øl-siden: mere luft mellem sektionerne på desktop. */
  "section-loose": { base: "1.5rem", md: "2.5rem" },
  /** Et korts indvendige luft. */
  card: { base: "1rem", md: "1.25rem" },
  /** Mellem et korts dele (overskrift, indhold, fod). */
  stack: { base: "0.75rem", md: "1.25rem" },
} as const satisfies Record<string, { base: string; md: string }>;

export const SPACING_NAMES = Object.keys(spacing);
