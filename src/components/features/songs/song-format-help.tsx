import { CircleHelpIcon } from "lucide-react";

const RULES = [
  "En tom linje = nyt vers.",
  "Afsnit på en linje for sig i firkantede parenteser, fx [Omkvæd] eller [Vers 2].",
  "Akkorder på en linje for sig over teksten, fx G C D. Skal en akkord stå over et bestemt ord, så ryk den på plads med mellemrum – feltet har fast bredde.",
  "«capo: 2» på en linje for sig vises kun i akkordvisningen.",
  "Bliver en tekstlinje vist som akkord? Skriv \\ foran.",
];

/** The song-text format in five lines (SPEC §9.6), under the "Tekst og akkorder" field. */
export function SongFormatHelp() {
  return (
    <details className="group rounded-xl border border-border bg-cream/60">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-2 font-semibold text-olive [&::-webkit-details-marker]:hidden">
        <CircleHelpIcon aria-hidden className="size-5 shrink-0" />
        <span className="min-w-0">Sådan skriver du vers, akkorder og omkvæd</span>
      </summary>
      <ul className="grid list-disc gap-1.5 px-4 pt-1 pb-4 pl-9 text-[0.95rem] text-ink">
        {RULES.map((rule) => (
          <li key={rule} className="break-words">
            {rule}
          </li>
        ))}
      </ul>
    </details>
  );
}
