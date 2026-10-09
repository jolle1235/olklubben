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
        <h1 className="text-[2rem] leading-[1.1] font-bold tracking-tight break-words hyphens-auto text-olive md:text-[2.5rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-[60ch] text-[1.05rem] break-words hyphens-auto text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-3">{action}</div> : null}
    </header>
  );
}
