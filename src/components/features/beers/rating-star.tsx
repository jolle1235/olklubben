import { StarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { ratingAriaLabel, type StarFill } from "@/server/domain/ratings/ratings";

import { starHitValues } from "./rating-input";

export type RatingStarProps = {
  /** 0–4, left to right. */
  index: number;
  /** How much of the star is filled (the saved value, or the hover preview). */
  fill: StarFill;
  /** True while a mouse hover previews a value that is not saved. */
  preview: boolean;
  /** The radio group's name (unique on the page). */
  name: string;
  /** The checked value (2..10), or null. */
  checked: number | null;
  onSelect: (value: number) => void;
  onPreview: (value: number) => void;
  /** Registers the radio of a value, so the group can move focus to it. */
  registerInput: (value: number, element: HTMLInputElement | null) => void;
};

/**
 * One star of <BeerRating />: the glyph plus its hit areas. Each hit area is a
 * visually hidden native radio with an empty <label> over its half of the star
 * (the first star has one area: 1 star). The hit areas reach into the gap
 * between the stars, so a tap between two stars still counts.
 *
 * Each radio + label pair has its own wrapper, so `peer-focus-visible` only
 * marks the focused half (a bar under it).
 */
export function RatingStar({
  index,
  fill,
  preview,
  name,
  checked,
  onSelect,
  onPreview,
  registerInput,
}: RatingStarProps) {
  const values = starHitValues(index);

  return (
    <span className="relative block size-(--star-size)">
      <StarGlyph fill={fill} preview={preview} />
      {values.map((value, half) => (
        <span
          key={value}
          className={cn(
            "absolute inset-y-0",
            values.length === 1
              ? "-inset-x-(--star-reach)"
              : half === 0
                ? "right-1/2 -left-(--star-reach)"
                : "-right-(--star-reach) left-1/2",
          )}
        >
          <input
            ref={(element) => registerInput(value, element)}
            type="radio"
            id={`${name}-${value}`}
            name={name}
            value={value}
            checked={checked === value}
            onChange={() => onSelect(value)}
            aria-label={ratingAriaLabel(value)}
            className="peer sr-only"
          />
          <label
            htmlFor={`${name}-${value}`}
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") onPreview(value);
            }}
            className="absolute inset-0 cursor-pointer after:absolute after:inset-x-1.5 after:top-[calc(100%+0.3rem)] after:h-1 after:rounded-full peer-focus-visible:after:bg-olive"
          />
        </span>
      ))}
    </span>
  );
}

/**
 * The star itself: an amber-ink outline with an amber-ink fill clipped to a
 * half or the whole star, ≥ 3:1 on paper and cream (WCAG 1.4.11), like the
 * read-only <RatingStars /> and <BeerCard />. A hover preview fills with the
 * lighter amber, so it never looks saved. Amber as the saved colour is for
 * the harbor panel only (<RatingSummary />).
 */
function StarGlyph({ fill, preview }: { fill: StarFill; preview: boolean }) {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 text-amber-ink">
      <StarIcon className="absolute inset-0 size-full" strokeWidth={1.5} />
      {fill === "empty" ? null : (
        <span
          className={cn(
            "absolute inset-y-0 left-0 overflow-hidden transition-[width] duration-150",
            fill === "half" ? "w-1/2" : "w-full",
          )}
        >
          <StarIcon
            className={cn(
              "size-(--star-size) max-w-none transition-colors duration-150",
              preview ? "fill-amber" : "fill-amber-ink",
            )}
            strokeWidth={1.5}
          />
        </span>
      )}
    </span>
  );
}
