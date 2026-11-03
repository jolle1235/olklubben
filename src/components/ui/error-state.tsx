import { BeerOffIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type ErrorStateProps = {
  title?: React.ReactNode;
  /** What went wrong and what the user can do about it. */
  description?: React.ReactNode;
  /** Retry slot, e.g. <Button onClick={retry}>Prøv igen</Button> in a client component. */
  action?: React.ReactNode;
  /** Small print, e.g. an error digest for support. */
  detail?: React.ReactNode;
  as?: "h1" | "h2" | "h3";
  className?: string;
};

/** Error state with an actionable message (SPEC §13.5, §15.1). Announced via role="alert". */
export function ErrorState({
  title = "Noget gik galt\u00a0– prøv igen.",
  description = "Vi har tørret disken af.",
  action,
  detail,
  as: Heading = "h2",
  className,
}: ErrorStateProps) {
  return (
    <section
      role="alert"
      className={cn(
        "flex flex-col items-center rounded-2xl border border-destructive-border bg-card px-6 py-10 text-center md:px-10",
        className,
      )}
    >
      <div
        aria-hidden
        className="mb-6 grid size-16 place-items-center porthole rounded-full bg-destructive-subtle text-destructive-ink [&_svg]:size-7"
      >
        <BeerOffIcon />
      </div>
      <Heading className="max-w-[26ch] text-title-md leading-tight font-bold text-primary-ink">
        {title}
      </Heading>
      {description ? (
        <div className="mt-2 max-w-[44ch] text-lead text-muted-foreground">{description}</div>
      ) : null}
      {action ? (
        <div className="mt-6 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row">
          {action}
        </div>
      ) : null}
      {detail ? <p className="mt-5 text-label-lg text-muted-foreground">{detail}</p> : null}
    </section>
  );
}
