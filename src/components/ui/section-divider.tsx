import { cn } from "@/lib/utils";

/** A quiet 1px line between major sections (SPEC §13.1). Hidden from screen readers. */
export function SectionDivider({ className }: { className?: string }) {
  return <div aria-hidden className={cn("h-px w-full shrink-0 bg-border", className)} />;
}
