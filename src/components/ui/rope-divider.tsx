import { cn } from "@/lib/utils";

export type RopeDividerProps = {
  /** "rope": a twisted rope. "wave": a calm wave line. */
  variant?: "rope" | "wave";
  className?: string;
};

/** Decorative divider between major sections (SPEC §13.1). Hidden from screen readers. */
export function RopeDivider({ variant = "rope", className }: RopeDividerProps) {
  return (
    <div
      aria-hidden
      className={cn("w-full shrink-0", variant === "rope" ? "rope-line" : "wave-line", className)}
    />
  );
}
