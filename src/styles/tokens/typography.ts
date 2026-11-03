/**
 * Typeskalaen (SPEC §13.3): tekst-roller med størrelse, linjehøjde og
 * tracking. Det ENESTE sted med skriftstørrelser og linjehøjder. `npm run
 * tokens` skriver dem i tokens.css som Tailwind-utilities (`text-title-sm`,
 * `text-body-md` …), og Tailwinds egne størrelser (`text-lg`,
 * `text-[0.95rem]`) findes ikke.
 *
 * Linjehøjde og tracking hører til størrelsen, ikke til komponenten (Apple,
 * "The Details of UI Typography"): store overskrifter får tæt linjehøjde og
 * negativ tracking, brødtekst luft og 0. typography.test.ts holder reglen.
 *
 * Som Apples tekst-stilarter har nogle roller en tæt og en luftig variant
 * (`text-body-sm-tight`, `text-body-lg-loose`): tæt til tekst i trange
 * flader (feltetiketter, chips, titler i lister), luftig til lange tekster
 * (beskrivelser, sangeditoren). En komponent vælger en variant, aldrig et
 * tal. Kun `leading-none` er tilladt lokalt, til ét tal eller tegn i en boks
 * (dagens nummer, initialer, bundnavigationens etiketter).
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
  /** Linjehøjden i `text-<rolle>-tight`, hvis rollen har den variant. */
  tight?: number;
  /** Linjehøjden i `text-<rolle>-loose`, hvis rollen har den variant. */
  loose?: number;
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
  "title-md": { size: "1.5rem", leading: 1.25, tracking: -0.015 },
  /** Titler på kort og i kort. Tæt: titler over flere linjer i en smal spalte. */
  "title-sm": { size: "1.25rem", leading: 1.375, tracking: -0.01, tight: 1.25 },

  /** Fremhævet brødtekst. Tæt: titler i lister og kort. Luftig: et events beskrivelse. */
  "body-lg": { size: "1.125rem", leading: 1.5, tracking: 0, tight: 1.3, loose: 1.625 },
  /** Indledninger: sidens beskrivelse, korte forklaringer under en titel. */
  lead: { size: "1.05rem", leading: 1.5, tracking: 0, tight: 1.3, loose: 1.625 },
  /** Brødtekst, knapper og felter. */
  "body-md": { size: "1rem", leading: 1.5, tracking: 0, tight: 1.3, loose: 1.625 },
  /** Sekundære linjer: "Hos Mads · 18:30", hjælpetekster. Tæt: feltetiketter. */
  "body-sm": { size: "0.95rem", leading: 1.5, tracking: 0, tight: 1.3, loose: 1.625 },

  /** Små tekster: knapper i "sm", tooltips, felt-hints. Tæt: kalenderens chips. */
  "label-lg": { size: "0.875rem", leading: 1.43, tracking: 0, tight: 1.25 },
  /** Chips, badges, bundnavigationens etiketter, versal-etiketter. */
  "label-md": { size: "0.8125rem", leading: 1.35, tracking: 0, tight: 1.25 },
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

/**
 * Alle `text-*`-utilities: rollerne og deres tætte og luftige varianter, hver
 * med én linjehøjde. Det er dem, tokens.css og `cn` kender.
 */
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

/**
 * Tracking til VERSALER (utilities'ne `caps` og `caps-wide`, som også sætter
 * uppercase): store bogstaver står for tæt uden ekstra luft, uanset størrelse.
 */
export const capsTracking = { caps: 0.14, "caps-wide": 0.2 } as const;
