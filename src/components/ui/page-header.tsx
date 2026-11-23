import { cn } from "@/lib/utils";

export type PageHeaderProps = {
  title: string;
  description?: React.ReactNode;
  /**
   * The screen's one primary action (SPEC §13.4), e.g. a <Button>. On mobile it
   * sits on its own line under the title (D-179: no add action in the top bar);
   * give its buttons `max-md:w-full` to fill that line.
   */
  action?: React.ReactNode;
  /**
   * A main page (D-189): below md the mobile top bar shows the name, so the
   * h1 is only for screen readers there; from md it shows as usual.
   */
  titleInTopBar?: boolean;
  className?: string;
};

/** Page title (the page's only <h1>) with an optional description and primary action. */
export function PageHeader({
  title,
  description,
  action,
  titleInTopBar = false,
  className,
}: PageHeaderProps) {
  const onlyTitle = !description && !action;
  return (
    <header
      className={cn(
        "mb-header flex flex-wrap items-end justify-between gap-x-6 gap-y-4",
        titleInTopBar && (onlyTitle ? "max-md:mb-0" : "max-md:gap-y-0"),
        className,
      )}
    >
      <div className="min-w-0 flex-1 basis-64">
        <h1
          className={cn(
            "text-page-title font-bold break-words hyphens-auto text-primary-ink",
            titleInTopBar && "max-md:sr-only",
          )}
        >
          {title}
        </h1>
        {description ? (
          <p
            className={cn(
              "max-w-[60ch] text-lead break-words hyphens-auto text-muted-foreground",
              titleInTopBar ? "md:mt-2" : "mt-2",
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-3 max-md:w-full">{action}</div> : null}
    </header>
  );
}
