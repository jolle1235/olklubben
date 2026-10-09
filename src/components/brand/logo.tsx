import { cn } from "@/lib/utils";

/*
 * Ølklubbens mærke: et koøje (porthole) med en ølkrus bag glasset.
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
      {/* krus med skum */}
      <g transform="translate(-1.75 0.5)">
        <path
          d="M30.5 22.5h2.25a3.75 3.75 0 0 1 3.75 3.75v2.5a3.75 3.75 0 0 1-3.75 3.75H30.5"
          fill="none"
          stroke="#D99A1E"
          strokeWidth="2.6"
        />
        <rect x="14.5" y="19" width="17" height="17.5" rx="2.5" fill="#D99A1E" />
        <path
          d="M18.5 24v8.5M23 24v8.5M27.5 24v8.5"
          stroke="#B67D10"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M14 20.5a3.6 3.6 0 0 1 3.4-4.4 4.6 4.6 0 0 1 8.3-1.2 3.8 3.8 0 0 1 6.3 3.1 2.6 2.6 0 0 1-.5 4.6c-.9.4-1.6-.2-2.5-.2H17.2c-1.6 0-3.2-.3-3.2-1.9Z"
          fill="#F6F0E1"
        />
      </g>
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
