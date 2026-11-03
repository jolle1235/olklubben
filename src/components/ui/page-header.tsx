import { cn } from "@/lib/utils";

export type PageHeaderProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** The screen's one primary action (SPEC §13.4), e.g. a <Button>. */
  action?: React.ReactNode;
  className?: string;
};

/** Page title (the page's only <h1>) with an optional description and primary action. */
export function PageHeader({ title, description, action, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 md:mb-8",
        className,
      )}
    >
      <div className="min-w-0 flex-1 basis-64">
        <h1 className="text-headline-md font-bold break-words hyphens-auto text-primary-ink md:text-headline-lg">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-[60ch] text-lead break-words hyphens-auto text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-3">{action}</div> : null}
    </header>
  );
}
