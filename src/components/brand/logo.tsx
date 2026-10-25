import { cn } from "@/lib/utils";

/*
 * Ølklubbens mærke: et koøje (porthole) med to ølglas, der skåler, bag glasset.
 * Maritimt krydderi, ikke pirat (SPEC §13.1). Samme tegning ligger i src/app/icon.svg.
 */
type LogoMarkProps = {
  className?: string;
  /** Giver mærket et tilgængeligt navn. Udelad, når ordmærket står ved siden af. */
  title?: string;
};

export function LogoMark({ className, title }: LogoMarkProps) {
  const labelled = Boolean(title);
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("size-8 shrink-0", className)}
      role={labelled ? "img" : undefined}
      aria-label={labelled ? title : undefined}
      aria-hidden={labelled ? undefined : true}
      focusable="false"
    >
      {/* skrog (olive) + messingring om glasset (harbor) */}
      <circle cx="24" cy="24" r="23" fill="#414437" />
      <circle cx="24" cy="24" r="19.25" fill="#3E5568" stroke="#D99A1E" strokeWidth="4.5" />
      {/* bolte i ringen */}
      <g fill="#414437">
        <circle cx="24" cy="4.75" r="1.15" />
        <circle cx="43.25" cy="24" r="1.15" />
        <circle cx="24" cy="43.25" r="1.15" />
        <circle cx="4.75" cy="24" r="1.15" />
      </g>
      {/* refleks i glasset */}
      <path
        d="M9.9 15.85A16.3 16.3 0 0 1 15.85 9.9"
        fill="none"
        stroke="#F6F0E1"
        strokeOpacity=".35"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* skål: gnister og to glas, der klinker (et omrids i glassets blå skiller dem) */}
      <path
        d="M24 9.6v3.4M19.2 11.3l1.6 2.8M28.8 11.3l-1.6 2.8"
        fill="none"
        stroke="#F2C46A"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {[
        { x: 16.4, r: 17 },
        { x: 31.6, r: -17 },
      ].map(({ x, r }) => (
        <g key={x} transform={`translate(${x} 36.4) rotate(${r})`}>
          <g stroke="#3E5568" strokeWidth="1.3" strokeLinejoin="round" paintOrder="stroke">
            <path d="M-4.6 -13.2h9.2l-1.05 13.2h-7.1Z" fill="#D99A1E" />
            <path
              d="M-5.1 -12.2a1.9 1.9 0 0 1 .9-3.1 2.4 2.4 0 0 1 4.1-1 2.4 2.4 0 0 1 4.3.3 1.9 1.9 0 0 1 .9 3.2c-.4.9-1.3 1.2-2.2 1.2h-5.9c-1 0-1.8-.2-2.1-.6Z"
              fill="#F6F0E1"
            />
          </g>
          <path
            d="M-2.7 -10.4l.45 8.3"
            stroke="#F6F0E1"
            strokeOpacity=".6"
            strokeWidth="1.15"
            strokeLinecap="round"
          />
          <path d="M2.5 -10.4l-.5 8.3" stroke="#B67D10" strokeWidth="1.3" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
}

type LogoProps = {
  className?: string;
  /** "cream" på mørke flader (olive/harbor), "olive" på lyse flader. */
  tone?: "cream" | "olive";
  size?: "sm" | "md" | "lg";
};

const sizes = {
  sm: { mark: "size-7", text: "text-lg" },
  md: { mark: "size-9", text: "text-[1.35rem]" },
  lg: { mark: "size-14", text: "text-[2rem]" },
} as const;

/** Mærke + ordmærke "Ølklubben". Wrap selv i et link, hvis det skal være klikbart. */
export function Logo({ className, tone = "olive", size = "md" }: LogoProps) {
  const s = sizes[size];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5",
        tone === "cream" ? "text-cream" : "text-olive",
        className,
      )}
    >
      <LogoMark className={s.mark} />
      {/* leading-none after the size: Tailwind's text-* sizes carry their own line height (F-016). */}
      <span className={cn("font-display font-bold tracking-tight", s.text, "leading-none")}>
        Ølklubben
      </span>
    </span>
  );
}
