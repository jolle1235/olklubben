import { cn } from "@/lib/utils";

/** The radio's state and handlers, from the PlaceSelector. */
export type PlaceChoiceCardProps = {
  /** Unique on the page; the radio's id. */
  id: string;
  value: string;
  checked: boolean;
  /**
   * Radio: called when this card becomes checked. Checkbox: called on EVERY
   * toggle (the caller flips its own state; `checked` is controlled).
   */
  onSelect: (value: string) => void;
  /** "radio" (default, the event form) or "checkbox" (the poll form's places, D-135). */
  type?: "radio" | "checkbox";
  /** The submitted field name. Default "placeId" (the event form). */
  name?: string;
  /** The accessible name: exactly the place's name (+ "(arkiveret)"), nothing else. */
  label: React.ReactNode;
  /** The second line ("Søndergade 12 · Ejer: Mads"), wired as the radio's description. */
  meta?: string | null;
  /**
   * The ChoiceFieldset's error/hint ids, so the group's message is read on
   * focus. (No aria-invalid: the radio role does not support it.)
   */
  describedBy?: string;
  /** Rendered under the card; reveal it with CSS while this radio is checked ("＋ Nyt sted"). */
  children?: React.ReactNode;
  className?: string;
};

/**
 * One choice in the PlaceSelector (SPEC §9.2, D-099): a NATIVE radio
 * (name=placeId), visually hidden, with a card as its label. The poll form
 * uses the checkbox variant (`type="checkbox"`, `name="placeIds"`, D-135,
 * TG-054); the class `place-radio` is kept on both, so the CSS reveal below
 * works for a checked "＋ Nyt sted" checkbox too. It works before
 * hydration, the arrow keys move between the cards, and the browser submits
 * exactly what is shown. The card draws the radio dot and the focus ring from
 * the radio's state (peer-*), and `children` (the new place's fields) show
 * only while it is checked – pure CSS, no JavaScript: give them
 * `hidden group-has-[.place-radio:checked]/choice:grid`.
 *
 * The meta line is aria-hidden inside the label (so it is not part of the
 * name) and referenced by aria-describedby (so it is still read).
 */
export function PlaceChoiceCard({
  id,
  value,
  checked,
  onSelect,
  type = "radio",
  name = "placeId",
  label,
  meta,
  describedBy,
  children,
  className,
}: PlaceChoiceCardProps) {
  const metaId = `${id}-meta`;
  const description = [describedBy, meta ? metaId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("group/choice grid min-w-0 grid-cols-1", className)}>
      <div className="relative grid grid-cols-1">
        {/* Invisible but on top of the card: taps, clicks and tests hit the radio itself. */}
        <input
          type={type}
          id={id}
          name={name}
          value={value}
          checked={checked}
          onChange={(event) => {
            if (type === "checkbox" || event.currentTarget.checked) onSelect(value);
          }}
          aria-describedby={description}
          className="place-radio peer absolute inset-0 z-10 m-0 size-full cursor-pointer appearance-none rounded-xl opacity-0"
        />
        <label
          htmlFor={id}
          className={cn(
            "flex min-h-14 items-start gap-3 rounded-xl border-2 border-border bg-paper px-3.5 py-3 text-ink transition-colors peer-hover:border-olive/50 peer-hover:bg-cream-deep/40",
            "before:mt-0.5 before:size-5 before:shrink-0 before:border-2 before:border-slate before:bg-paper before:content-['']",
            "peer-checked:border-olive peer-checked:bg-olive-tint",
            type === "radio"
              ? // The radio dot: an empty ring, filled when checked.
                "before:rounded-full peer-checked:before:border-[6px] peer-checked:before:border-olive"
              : // The checkbox: an empty square, olive with a tick when checked. The tick
                // has empty alt text (`/ ''`), so it is not part of the accessible name.
                "before:grid before:place-items-center before:rounded-[5px] before:text-[0.8rem] before:leading-none before:font-bold before:text-paper peer-checked:before:border-olive peer-checked:before:bg-olive peer-checked:before:content-['✓'_/_'']",
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
      </div>
      {children}
    </div>
  );
}
