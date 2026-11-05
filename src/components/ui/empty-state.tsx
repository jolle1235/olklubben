import { cn } from "@/lib/utils";

export type EmptyStateProps = {
  /** An emoji ("🍺") or an icon element (<BeerIcon />). Shown in a porthole. */
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Buttons/links. An empty screen is an invitation to act. */
  actions?: React.ReactNode;
  /** Heading level for the title. Default h2 (the page usually has its own h1). */
  as?: "h1" | "h2" | "h3";
  className?: string;
};

/** Empty state: icon, title, short text and actions (SPEC §9.1, §13.5). */
export function EmptyState({
  icon,
  title,
  description,
  actions,
  as: Heading = "h2",
  className,
}: EmptyStateProps) {
  return (
    <section
      className={cn(
        "flex flex-col items-center rounded-2xl border-2 border-dashed border-border bg-card-faint px-6 py-10 text-center md:px-10 md:py-12",
        className,
      )}
    >
      {icon ? (
        <div
          aria-hidden
          className="mb-6 grid size-16 place-items-center porthole rounded-full bg-muted text-headline-sm text-primary-ink [&_svg]:size-7"
        >
          {icon}
        </div>
      ) : null}
      <Heading className="max-w-[24ch] text-title-md font-bold text-primary-ink md:text-title-lg">
        {title}
      </Heading>
      {description ? (
        <div className="mt-2 max-w-[44ch] text-lead text-muted-foreground">{description}</div>
      ) : null}
      {actions ? (
        <div className="mt-6 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
          {actions}
        </div>
      ) : null}
    </section>
  );
}
