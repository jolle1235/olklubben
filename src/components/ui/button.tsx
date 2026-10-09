import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";

// Restyled for Ølklubben (SPEC §13). Every size is at least 44 px tall on touch
// screens (§13.4); "sm"/"xs" only shrink where the pointer is fine (mouse).
// Focus uses the global :focus-visible outline from globals.css.
const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-transparent bg-clip-padding font-semibold whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] select-none active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[1.15em]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[inset_0_-2px_0_rgb(0_0_0/0.22)] hover:bg-olive-deep",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--olive)_8%)] aria-expanded:bg-[color-mix(in_oklch,var(--secondary),var(--olive)_8%)]",
        outline: "border-input bg-paper text-ink hover:bg-cream-deep aria-expanded:bg-cream-deep",
        ghost: "text-ink hover:bg-cream-deep aria-expanded:bg-cream-deep",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[inset_0_-2px_0_rgb(0_0_0/0.22)] hover:bg-danger-deep",
        /** Messing-knap til mørke flader (top bar, hero). ink på amber: 6,92:1 (olive ville kun give 4,08:1). */
        brass: "bg-amber text-ink shadow-[inset_0_-2px_0_rgb(0_0_0/0.18)] hover:bg-amber-light",
        link: "h-auto! px-0! text-primary underline decoration-2 underline-offset-4 hover:decoration-amber",
      },
      size: {
        default:
          "h-11 px-5 text-base has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        xs: "h-8 gap-1 rounded-md px-2.5 text-sm pointer-coarse:h-11 pointer-coarse:px-3.5",
        sm: "h-9 gap-1.5 px-3.5 text-sm pointer-coarse:h-11 pointer-coarse:px-4",
        lg: "h-13 px-7 text-lg",
        icon: "size-11",
        "icon-xs": "size-8 rounded-md pointer-coarse:size-11",
        "icon-sm": "size-9 pointer-coarse:size-11",
        "icon-lg": "size-13",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
