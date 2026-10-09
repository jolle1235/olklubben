import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * An underlined text link (not colour alone, WCAG 1.4.1). Olive (primary) by
 * default; pass `className="text-inherit"` inside a coloured alert.
 */
export function TextLink({ className, ...props }: React.ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(
        "rounded-sm font-semibold text-primary underline decoration-current/40 decoration-2 underline-offset-4 transition-colors hover:decoration-amber",
        className,
      )}
      {...props}
    />
  );
}
