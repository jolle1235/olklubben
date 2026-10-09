import { formatDayMonthParts, toDateKey, type DateInput } from "@/lib/format/date";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { day: "text-3xl", month: "text-[0.7rem] tracking-[0.14em]" },
  md: { day: "text-5xl", month: "text-xs tracking-[0.16em]" },
  lg: { day: "text-7xl md:text-8xl", month: "text-sm tracking-[0.2em] md:text-base" },
} as const;

export type BigDateProps = {
  date: DateInput;
  size?: keyof typeof SIZES;
  className?: string;
};

/**
 * The big date motif from SPEC §13.3: "23 / OKTOBER".
 * The color comes from the parent (currentColor), so it works on cream, olive and harbor.
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
      <span className={cn("font-bold tracking-tight", s.day)}>{parts.day}</span>
      {/* The "/" from "23 / OKTOBER", drawn as a short brass rule. */}
      <span
        aria-hidden
        className={cn("my-[0.45em] h-[3px] w-[2.2em] rounded-full bg-amber", s.month)}
      />
      <span className={cn("font-semibold uppercase", s.month)}>{parts.month}</span>
    </time>
  );
}
