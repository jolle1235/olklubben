"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnchorIcon, ChevronDownIcon, ChevronRightIcon, PlusIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { ClubBadge } from "@/components/features/club-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { clubNameSize } from "./club-name-size";

export type ClubSummary = { id: string; name: string };

export type ClubSwitcherProps = {
  club: ClubSummary;
  clubs: ClubSummary[];
  /** "sidebar": block with badge (desktop). "topbar": compact title (mobile). */
  variant?: "sidebar" | "topbar";
  className?: string;
};

const clubPath = (id: string) => `/c/${encodeURIComponent(id)}`;

/**
 * The active club's name (SPEC §3.1, §8.1). With one club it is a link to the
 * club page; with more it opens a menu to switch club, like switching profile on
 * Instagram. Always on an olive surface (the app chrome).
 */
export function ClubSwitcher({ club, clubs, variant = "topbar", className }: ClubSwitcherProps) {
  const router = useRouter();
  const hasMany = clubs.length > 1;
  const isSidebar = variant === "sidebar";

  const triggerClass = cn(
    "group/club flex min-h-11 min-w-0 items-center rounded-xl text-left text-cream transition-colors hover:bg-olive-soft",
    isSidebar ? "w-full gap-2.5 bg-olive-soft/60 p-2.5 pr-2" : "max-w-full gap-3 px-2 py-1.5",
    hasMany && "data-[state=open]:bg-olive-soft",
    className,
  );

  const label = (
    <>
      <ClubBadge name={club.name} size={isSidebar ? "md" : "sm"} />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block font-display font-bold",
            isSidebar
              ? cn("line-clamp-2 break-words hyphens-auto", clubNameSize(club.name))
              : "truncate text-[1.2rem]",
            // After the size: Tailwind's text-* sizes carry their own line height.
            "leading-tight",
          )}
        >
          {club.name}
        </span>
        {isSidebar ? (
          <span className="block text-sm text-on-dark-muted">
            {hasMany ? "Skift klub" : "Klubbens side"}
          </span>
        ) : null}
      </span>
    </>
  );

  if (!hasMany) {
    return (
      <Link href={`${clubPath(club.id)}/club`} className={triggerClass}>
        <span className="sr-only">Klubbens side: </span>
        {label}
        <ChevronRightIcon
          aria-hidden
          className="size-4 shrink-0 text-on-dark-muted transition-transform group-hover/club:translate-x-0.5"
        />
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={triggerClass} aria-label={`${club.name}. Skift klub`}>
        {label}
        <ChevronDownIcon
          aria-hidden
          className="size-5 shrink-0 text-amber transition-transform group-data-[state=open]/club:rotate-180"
        />
      </DropdownMenuTrigger>
      {/* Portalled, so on desktop it may be wider than the sidebar: club names get
          room instead of an ellipsis. */}
      <DropdownMenuContent align="start" sideOffset={8} className="w-[min(20rem,calc(100vw-2rem))]">
        <DropdownMenuLabel>Dine klubber</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={club.id}
          onValueChange={(id) => {
            if (id !== club.id) router.push(clubPath(id));
          }}
        >
          {clubs.map((item) => (
            <DropdownMenuRadioItem key={item.id} value={item.id} className="gap-3">
              <ClubBadge name={item.name} size="sm" />
              <span className="line-clamp-2 min-w-0 flex-1 font-semibold break-words hyphens-auto">
                {item.name}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`${clubPath(club.id)}/club`}>
            <AnchorIcon aria-hidden className="text-olive" />
            Klubbens side
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/onboarding">
            <PlusIcon aria-hidden className="text-olive" />
            Opret eller join ny klub
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
