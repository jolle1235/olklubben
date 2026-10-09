import { RopeDivider } from "@/components/ui/rope-divider";
import { cn } from "@/lib/utils";

export type EventSectionProps = {
  /** id of the h2, for aria-labelledby. Unique on the page. */
  id: string;
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

/**
 * A section of the event page ("Planen", "Øl smagt til dette event", SPEC
 * §9.2): a rope line, then a centred h2, like the invitation mock.
 */
export function EventSection({ id, title, children, className }: EventSectionProps) {
  return (
    <section aria-labelledby={id} className={cn("grid grid-cols-1 gap-5", className)}>
      <RopeDivider />
      <h2
        id={id}
        className="text-center text-2xl leading-tight break-words hyphens-auto text-olive md:text-[1.75rem]"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
