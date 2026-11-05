/**
 * Typeskalaen (SPEC §13.3): det eneste sted med skriftstørrelser og
 * linjehøjder. Skrifterne står i src/components/brand/fonts.ts.
 */

export type TextStyle = {
  /** I rem, så teksten følger browserens skriftstørrelse. */
  size: string;
  /** Faktor af størrelsen. */
  leading: number;
  /** I em. */
  tracking: number;
  /** Giver `text-<rolle>-tight` med denne linjehøjde. */
  tight?: number;
  /** Giver `text-<rolle>-loose` med denne linjehøjde. */
  loose?: number;
};

export const textStyles = {
  /** Store tal og datoer. */
  "display-xl": { size: "6rem", leading: 1, tracking: -0.03 },
  "display-lg": { size: "4.5rem", leading: 1, tracking: -0.03 },
  "display-md": { size: "3rem", leading: 1.05, tracking: -0.025 },
  "display-sm": { size: "2.25rem", leading: 1.1, tracking: -0.025 },

  /** Sidens h1: `headline-md` på mobil, `headline-lg` på desktop. */
  "headline-lg": { size: "2.5rem", leading: 1.1, tracking: -0.025 },
  "headline-md": { size: "2rem", leading: 1.1, tracking: -0.025 },
  "headline-sm": { size: "1.875rem", leading: 1.2, tracking: -0.02 },

  /** Sektionsoverskrifter: `title-md` på mobil, `title-lg` på desktop. */
  "title-lg": { size: "1.75rem", leading: 1.25, tracking: -0.02 },
  "title-md": { size: "1.5rem", leading: 1.25, tracking: -0.015 },
  "title-sm": { size: "1.25rem", leading: 1.375, tracking: -0.01, tight: 1.25 },

  "body-lg": { size: "1.125rem", leading: 1.5, tracking: 0, tight: 1.3, loose: 1.625 },
  /** Indledningen under en titel. */
  lead: { size: "1.05rem", leading: 1.5, tracking: 0, tight: 1.3, loose: 1.625 },
  "body-md": { size: "1rem", leading: 1.5, tracking: 0, tight: 1.3, loose: 1.625 },
  "body-sm": { size: "0.95rem", leading: 1.5, tracking: 0, tight: 1.3, loose: 1.625 },

  "label-lg": { size: "0.875rem", leading: 1.43, tracking: 0, tight: 1.25 },
  "label-md": { size: "0.8125rem", leading: 1.35, tracking: 0, tight: 1.25 },
  "label-sm": { size: "0.75rem", leading: 1.333, tracking: 0 },
} as const satisfies Record<string, TextStyle>;

/** Som farvernes lag 3: hver bruges kun af én komponent. */
export const componentTextStyles = {
  /** InviteShare: fylder bredden uden at bryde, spredt til oplæsning. */
  "invite-code": { size: "clamp(1.9rem, 9.5vw, 3rem)", leading: 1, tracking: 0.06 },
} as const satisfies Record<string, TextStyle>;

/** Alle `text-*`-utilities, inkl. -tight/-loose. Både tokens.css og `cn` bygger på dem. */
export function textUtilities(): Record<string, Omit<TextStyle, "tight" | "loose">> {
  const styles: Record<string, TextStyle> = { ...textStyles, ...componentTextStyles };
  return Object.fromEntries(
    Object.entries(styles).flatMap(([name, { size, leading, tracking, tight, loose }]) => [
      [name, { size, leading, tracking }],
      ...(tight === undefined ? [] : [[`${name}-tight`, { size, leading: tight, tracking }]]),
      ...(loose === undefined ? [] : [[`${name}-loose`, { size, leading: loose, tracking }]]),
    ]),
  );
}

export const TEXT_ROLES = Object.keys(textUtilities());

/** Utilities'ne `caps` og `caps-wide`: uppercase med ekstra tracking i em. */
export const capsTracking = { caps: 0.14, "caps-wide": 0.2 } as const;
