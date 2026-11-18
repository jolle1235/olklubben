"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnchorIcon, ChevronDownIcon, ChevronRightIcon, PlusIcon } from "lucide-react";

import { clubHref, overviewHref } from "@/lib/routes";
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
};

/**
 * The active club's name (SPEC §3.1, §8.1). With one club it is a link to the
 * club page; with more it opens a menu to switch club, like switching profile on
 * Instagram. In the desktop sidebar; on mobile, clubs are switched in
 * Indstillinger (D-183).
 */
export function ClubSwitcher({ club, clubs }: ClubSwitcherProps) {
  const router = useRouter();
  const hasMany = clubs.length > 1;

  const triggerClass = cn(
    "group/club flex min-h-11 min-w-0 items-center rounded-xl pressable-row text-left text-frame-foreground hover:bg-frame-hover",
    "w-full gap-2.5 bg-frame-faint p-2.5 pr-2",
    hasMany && "data-[state=open]:bg-frame-hover",
  );

  const label = (
    <>
      <ClubBadge name={club.name} size="md" />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "line-clamp-2 block font-display font-bold break-words hyphens-auto",
            clubNameSize(club.name),
          )}
        >
          {club.name}
        </span>
        <span className="block text-label-lg text-frame-muted-foreground">
          {hasMany ? "Skift klub" : "Klubbens side"}
        </span>
      </span>
    </>
  );

  if (!hasMany) {
    return (
      <Link href={clubHref(club.id)} className={triggerClass}>
        <span className="sr-only">Klubbens side: </span>
        {label}
        <ChevronRightIcon
          aria-hidden
          className="size-4 shrink-0 text-frame-muted-foreground transition-transform group-hover/club:translate-x-0.5"
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
          className="size-5 shrink-0 text-highlight transition-transform group-data-[state=open]/club:rotate-180"
        />
      </DropdownMenuTrigger>
      {/* Portalled, so on desktop it may be wider than the sidebar: club names get
          room instead of an ellipsis. */}
      <DropdownMenuContent align="start" sideOffset={8} className="w-[min(20rem,calc(100vw-2rem))]">
        <DropdownMenuLabel>Dine klubber</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={club.id}
          onValueChange={(id) => {
            if (id !== club.id) router.push(overviewHref(id));
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
          <Link href={clubHref(club.id)}>
            <AnchorIcon aria-hidden className="text-primary-ink" />
            Klubbens side
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/onboarding">
            <PlusIcon aria-hidden className="text-primary-ink" />
            Opret eller join ny klub
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
