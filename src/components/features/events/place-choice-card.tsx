import { cn } from "@/lib/utils";

/** The radio's state and handlers, from the PlaceSelector. */
export type PlaceChoiceCardProps = {
  /** Unique on the page; the radio's id. */
  id: string;
  value: string;
  checked: boolean;
  onSelect: (value: string) => void;
  /** The accessible name: exactly the place's name (+ "(arkiveret)"), nothing else. */
  label: React.ReactNode;
  /** The second line ("Søndergade 12 · Ejer: Mads"), wired as the radio's description. */
  meta?: string | null;
  /** The ChoiceFieldset's error/hint ids, so the group's message is read on focus. */
  describedBy?: string;
  invalid?: true;
  /** Rendered after the label, revealed by CSS while this radio is checked ("＋ Nyt sted"). */
  children?: React.ReactNode;
  className?: string;
};

/**
 * One choice in the PlaceSelector (SPEC §9.2, D-099): a NATIVE radio
 * (name=placeId), visually hidden, with a card as its label. It works before
 * hydration, the arrow keys move between the cards, and the browser submits
 * exactly what is shown. The card draws the radio dot and the focus ring from
 * the radio's state (peer-*), and `children` (the new place's fields) show
 * only while it is checked – pure CSS, no JavaScript.
 *
 * The meta line is aria-hidden inside the label (so it is not part of the
 * name) and referenced by aria-describedby (so it is still read).
 */
export function PlaceChoiceCard({
  id,
  value,
  checked,
  onSelect,
  label,
  meta,
  describedBy,
  invalid,
  children,
  className,
}: PlaceChoiceCardProps) {
  const metaId = `${id}-meta`;
  const description = [describedBy, meta ? metaId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("relative grid min-w-0 grid-cols-1", className)}>
      <input
        type="radio"
        id={id}
        name="placeId"
        value={value}
        checked={checked}
        onChange={(event) => {
          if (event.currentTarget.checked) onSelect(value);
        }}
        aria-describedby={description}
        aria-invalid={invalid}
        className="peer sr-only"
      />
      <label
        htmlFor={id}
        className={cn(
          "flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border-2 border-border bg-paper px-3.5 py-3 text-ink transition-colors hover:border-olive/50 hover:bg-cream-deep/40",
          // The radio dot: an empty ring, filled when checked.
          "before:mt-0.5 before:size-5 before:shrink-0 before:rounded-full before:border-2 before:border-slate before:bg-paper before:content-['']",
          "peer-checked:border-olive peer-checked:bg-olive-tint peer-checked:before:border-[6px] peer-checked:before:border-olive",
          "peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
        )}
      >
        <span className="grid min-w-0 flex-1 grid-cols-1 gap-0.5">
          <span className="font-semibold break-words hyphens-auto">{label}</span>
          {meta ? (
            <span
              id={metaId}
              aria-hidden
              className="text-[0.95rem] break-words hyphens-auto text-slate"
            >
              {meta}
            </span>
          ) : null}
        </span>
      </label>
      {children}
    </div>
  );
}
