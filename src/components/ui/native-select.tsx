import { ChevronDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A native <select> styled like <Input>. Native on purpose: the phone's own
 * picker, keyboard support and it works without JavaScript (GET forms, Server
 * Action forms).
 */
export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <span className={cn("relative block", className)}>
      <select
        className="h-11 w-full min-w-0 cursor-pointer appearance-none truncate rounded-lg border border-input bg-card py-2 pr-10 pl-3.5 text-body-md text-foreground outline-offset-1 transition-colors focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-invalid-ring"
        {...props}
      />
      <ChevronDownIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </span>
  );
}
