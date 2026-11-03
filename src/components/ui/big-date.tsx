import { formatDayMonthParts, toDateKey, type DateInput } from "@/lib/format/date";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { day: "text-headline-sm", month: "text-label-sm caps" },
  md: { day: "text-display-md", month: "text-label-sm caps" },
  lg: {
    day: "text-display-lg md:text-display-xl",
    month: "text-label-lg caps-wide md:text-body-md",
  },
} as const;

export type BigDateProps = {
  date: DateInput;
  size?: keyof typeof SIZES;
  className?: string;
};

/**
 * The big date motif from SPEC §13.3: "23 / OKTOBER".
 * The color comes from the parent (currentColor), so it works on every surface.
 * Day, month and dateTime come from lib/format/date (Europe/Copenhagen, D-039),
 * so server and browser render the same text. Renders nothing for an invalid date.
 */
export function BigDate({ date, size = "md", className }: BigDateProps) {
  const parts = formatDayMonthParts(date);
  if (!parts) return null;
  const s = SIZES[size];

  return (
    <time
      dateTime={toDateKey(date)}
      className={cn("inline-flex flex-col items-start font-display leading-none", className)}
    >
      {/* Proportional digits: Zilla Slab's tabular "11" reads as "1 1" at this size. */}
      <span className={cn("font-bold", s.day)}>{parts.day}</span>
      {/* The "/" from "23 / OKTOBER", drawn as a short highlight rule. */}
      <span
        aria-hidden
        className={cn("my-[0.45em] h-[3px] w-[2.2em] rounded-full bg-highlight", s.month)}
      />
      <span className={cn("font-semibold", s.month)}>{parts.month}</span>
    </time>
  );
}
