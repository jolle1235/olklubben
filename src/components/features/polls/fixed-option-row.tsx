import { CalendarIcon, MapPinIcon } from "lucide-react";

export type FixedOptionRowProps = {
  category: "DATE" | "PLACE";
  /** "lørdag 21. november kl. 18:30" / "Hos Mads". */
  label: string;
  /** Places: "Søndergade 12 · Mads bliver vært". */
  meta?: string | null;
};

/**
 * A category with ONE option (SPEC §9.7.1): nothing to vote on, it is simply
 * part of the plan – "Hvor: Hos Mads · ligger fast". No input: the server
 * drops anything sent for it (C8).
 */
export function FixedOptionRow({ category, label, meta }: FixedOptionRowProps) {
  const Icon = category === "DATE" ? CalendarIcon : MapPinIcon;
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-xl border-2 border-dashed border-harbor/40 bg-harbor-tint/50 px-3.5 py-3">
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-harbor" />
      <p className="grid min-w-0 grid-cols-1 gap-0.5">
        <span className="break-words hyphens-auto text-ink">
          <span className="font-semibold">{category === "DATE" ? "Hvornår:" : "Hvor:"}</span>{" "}
          {label} <span className="text-slate">· ligger fast</span>
        </span>
        {meta ? (
          <span className="text-[0.95rem] break-words hyphens-auto text-slate">{meta}</span>
        ) : null}
      </p>
    </div>
  );
}
