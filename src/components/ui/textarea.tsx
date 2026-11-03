import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-28 w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-body-md text-foreground outline-offset-1 transition-colors placeholder:text-muted-foreground focus-visible:border-ring disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-invalid-ring",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
