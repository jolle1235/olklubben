import { SectionDivider } from "@/components/ui/section-divider";
import { cn } from "@/lib/utils";

export type EventSectionProps = {
  /** id of the h2, for aria-labelledby. Unique on the page. */
  id: string;
  title: React.ReactNode;
  /** A small button at the right of the centred title (the beers' ↻). */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

/**
 * A section of the event page ("Planen", "Øl smagt til dette event", SPEC
 * §9.2): a thin line, then a centred h2, like the invitation mock, with an
 * optional small action at its right.
 */
export function EventSection({ id, title, action, children, className }: EventSectionProps) {
  return (
    <section aria-labelledby={id} className={cn("grid grid-cols-1 gap-5", className)}>
      <SectionDivider />
      {/* Equal side columns keep the title centred whatever the action's width. */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <h2
          id={id}
          className="col-start-2 text-center text-feature-title break-words hyphens-auto text-primary-ink"
        >
          {title}
        </h2>
        {action ? <div className="justify-self-end">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
