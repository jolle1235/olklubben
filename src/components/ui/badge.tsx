import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Slot } from "radix-ui";

const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2.5 py-0.5 text-label-md font-semibold whitespace-nowrap transition-all has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary-hover",
        secondary: "bg-secondary text-secondary-foreground [a]:hover:bg-secondary-hover",
        destructive:
          "bg-destructive-subtle text-destructive-ink [a]:hover:bg-destructive-subtle-hover",
        outline: "border-input text-foreground [a]:hover:bg-muted",
        /** Fremhævning, fx "I aften!" (highlight-rollen). */
        highlight: "bg-highlight text-highlight-foreground [a]:hover:bg-highlight-hover",
        /** Info, fx "om 3 dage" (info-rollen). */
        info: "bg-info-subtle text-info-ink [a]:hover:bg-info-subtle-hover",
        ghost: "hover:bg-muted",
        link: "text-primary-ink underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
