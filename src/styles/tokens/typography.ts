/**
 * Typeskalaen (SPEC §13.3): tekst-roller med størrelse, linjehøjde og
 * tracking. Det ENESTE sted med skriftstørrelser. `npm run tokens` skriver
 * dem i tokens.css som Tailwind-utilities (`text-title-sm`, `text-body-md` …),
 * og Tailwinds egne størrelser (`text-lg`, `text-[0.95rem]`) findes ikke.
 *
 * Linjehøjde og tracking hører til størrelsen, ikke til komponenten (Apple,
 * "The Details of UI Typography"): store overskrifter får tæt linjehøjde og
 * negativ tracking, brødtekst luft og 0. typography.test.ts holder reglen.
 * En komponent kan stadig sætte `leading-none` o.l. til et enkelt element
 * (fx tal i en cirkel), men aldrig en vilkårlig værdi.
 *
 * Skrifterne selv (Zilla Slab, Source Sans 3) står i
 * src/components/brand/fonts.ts og bruges via `font-display`/`font-heading`
 * og `font-sans`.
 */

export type TextStyle = {
  /** rem (eller clamp() af rem), så teksten følger browserens skriftstørrelse. */
  size: string;
  /** Linjehøjde som faktor af størrelsen. */
  leading: number;
  /** Tracking i em: negativ strammer, positiv spreder. */
  tracking: number;
};

/** Rækkefølge: størst først inden for hver gruppe. */
export const textStyles = {
  /** Store tal og datoer: BigDate, 404, klubbens rating. */
  "display-xl": { size: "6rem", leading: 1, tracking: -0.03 },
  "display-lg": { size: "4.5rem", leading: 1, tracking: -0.03 },
  "display-md": { size: "3rem", leading: 1.05, tracking: -0.025 },
  /** Også invitationens titel og sangtitlen på desktop. */
  "display-sm": { size: "2.25rem", leading: 1.1, tracking: -0.025 },

  /** Sidetitler (sidens h1). Mobil `headline-md`, desktop `headline-lg`. */
  "headline-lg": { size: "2.5rem", leading: 1.1, tracking: -0.025 },
  "headline-md": { size: "2rem", leading: 1.1, tracking: -0.025 },
  /** Titler på de centrerede sider (login, invitationer) og sangtitlen. */
  "headline-sm": { size: "1.875rem", leading: 1.2, tracking: -0.02 },

  /** Sektionsoverskrifter (desktop), store tal på fremhævede kort. */
  "title-lg": { size: "1.75rem", leading: 1.25, tracking: -0.02 },
  /** Sektionsoverskrifter (mobil), dialogtitler. */
  "title-md": { size: "1.5rem", leading: 1.3, tracking: -0.015 },
  /** Titler på kort og i kort. */
  "title-sm": { size: "1.25rem", leading: 1.4, tracking: -0.01 },

  /** Listetitler og fremhævet brødtekst. */
  "body-lg": { size: "1.125rem", leading: 1.5, tracking: 0 },
  /** Indledninger: sidens beskrivelse, korte forklaringer under en titel. */
  lead: { size: "1.05rem", leading: 1.5, tracking: 0 },
  /** Brødtekst, knapper og felter. */
  "body-md": { size: "1rem", leading: 1.5, tracking: 0 },
  /** Sekundære linjer: "Hos Mads · 18:30", hjælpetekster, tællere. */
  "body-sm": { size: "0.95rem", leading: 1.5, tracking: 0 },

  /** Små tekster: knapper i "sm", tooltips, felt-hints. */
  "label-lg": { size: "0.875rem", leading: 1.43, tracking: 0 },
  /** Chips, badges, bundnavigationens etiketter, versal-etiketter. */
  "label-md": { size: "0.8125rem", leading: 1.35, tracking: 0 },
  /** Det mindste: ugedage i kalenderen, små avatarer. */
  "label-sm": { size: "0.75rem", leading: 1.333, tracking: 0 },
} as const satisfies Record<string, TextStyle>;

/**
 * Komponent-tekster med egne behov, ligesom farvesystemets lag 3. Bruges kun
 * af den komponent, der står ud for dem.
 */
export const componentTextStyles = {
  /** Invitationskoden (InviteShare): fylder bredden uden at bryde, spredt til oplæsning. */
  "invite-code": { size: "clamp(1.9rem, 9.5vw, 3rem)", leading: 1, tracking: 0.06 },
} as const satisfies Record<string, TextStyle>;

export type TextRole = keyof typeof textStyles | keyof typeof componentTextStyles;

export const TEXT_ROLES = [
  ...Object.keys(textStyles),
  ...Object.keys(componentTextStyles),
] as TextRole[];

/**
 * Tracking til VERSALER (utilities'ne `caps` og `caps-wide`, som også sætter
 * uppercase): store bogstaver står for tæt uden ekstra luft, uanset størrelse.
 */
export const capsTracking = { caps: 0.14, "caps-wide": 0.2 } as const;
