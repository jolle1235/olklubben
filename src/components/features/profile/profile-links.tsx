import Link from "next/link";
import {
  AnchorIcon,
  ArrowLeftRightIcon,
  ChevronRightIcon,
  MapPinIcon,
  PlusIcon,
  type LucideIcon,
} from "lucide-react";

import { clubHref, placesHref } from "@/lib/routes";

export type ProfileLinksProps = {
  clubId: string;
  /** How many clubs the user is in. "Mine klubber" shows from 2. */
  clubCount: number;
};

type Row = { href: string; icon: LucideIcon; title: string; subtitle: string };

/**
 * Shortcuts from Profil (SPEC §8.1, §9.8, D-023): "Klubben" (members and
 * invite link), "Steder" (the club's places, which have no main navigation
 * item), with more than one club "Mine klubber" (/clubs), and always "Opret
 * eller join ny klub" (/onboarding). With one club the ClubSwitcher is just a
 * link (§8.1), so this row is that user's only way to a second club.
 */
export function ProfileLinks({ clubId, clubCount }: ProfileLinksProps) {
  const rows: Row[] = [
    {
      href: clubHref(clubId),
      icon: AnchorIcon,
      title: "Klubben",
      subtitle: "Medlemmer og invitationslink",
    },
    {
      href: placesHref(clubId),
      icon: MapPinIcon,
      title: "Steder",
      subtitle: "Hvor I mødes, og hvem der ejer stederne",
    },
  ];
  if (clubCount > 1) {
    rows.push({
      href: "/clubs",
      icon: ArrowLeftRightIcon,
      title: "Mine klubber",
      subtitle: `Du er med i ${clubCount} klubber`,
    });
  }
  rows.push({
    href: "/onboarding",
    icon: PlusIcon,
    title: "Opret eller join ny klub",
    subtitle: "Start en ny ølklub eller join med en kode",
  });

  return (
    <nav aria-label="Klubber">
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {rows.map(({ href, icon: Icon, title, subtitle }) => (
          <li key={href} className="first:*:rounded-t-xl last:*:rounded-b-xl">
            {/* The list clips its children (overflow-hidden, for the rounded hover
                background), so the focus ring is drawn inside the row. */}
            <Link
              href={href}
              className="group/row flex min-h-16 items-center gap-4 px-4 py-3 transition-colors hover:bg-cream-deep/70 focus-visible:-outline-offset-3 md:px-5"
            >
              <span
                aria-hidden
                className="grid size-10 shrink-0 place-items-center rounded-full bg-olive text-amber [&_svg]:size-5"
              >
                <Icon strokeWidth={2.25} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-heading text-lg leading-tight font-semibold text-olive">
                  {title}
                </span>
                <span className="block text-[0.95rem] text-pretty text-muted-foreground">
                  {subtitle}
                </span>
              </span>
              <ChevronRightIcon
                aria-hidden
                className="size-5 shrink-0 text-slate transition-transform group-hover/row:translate-x-0.5"
              />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
