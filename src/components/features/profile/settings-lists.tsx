import { CheckIcon, PlusIcon } from "lucide-react";

import { ClubBadge } from "@/components/features/club-badge";
import { LinkRow, type LinkRowProps } from "@/components/features/link-row";
import { UserAvatar } from "@/components/ui/user-avatar";
import { overviewHref } from "@/lib/routes";

/**
 * The building blocks of Indstillinger (D-183): groups of rows in one rounded
 * card, like iOS's Settings. Each group is a region named by its heading.
 */

export const SETTINGS_LIST =
  "divide-y divide-border overflow-hidden rounded-xl border border-border bg-card";
/** The list clips its children (overflow-hidden, for the rounded hover), so the focus ring is drawn inside the row. */
export const SETTINGS_ROW = "pressable-row focus-visible:-outline-offset-3 md:px-5";

export function SettingsGroup({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="grid gap-2">
      <h2
        id={id}
        className="px-1 text-label-md font-bold caps break-words hyphens-auto text-muted-foreground"
      >
        {title}
      </h2>
      <ul className={SETTINGS_LIST}>{children}</ul>
    </section>
  );
}

/** A link row (icon or leading, title, subtitle, ›) in a group. */
export function SettingsLink(props: LinkRowProps) {
  return (
    <li>
      <LinkRow {...props} className={SETTINGS_ROW} />
    </li>
  );
}

/** A row with its own control, e.g. Udseende's segmented control. */
export function SettingsItem({ children }: { children: React.ReactNode }) {
  return <li className="grid gap-3 px-4 py-3 md:px-5">{children}</li>;
}

/** The account row: avatar, display name and email → Konto. */
export function AccountRow({
  href,
  name,
  email,
  image,
}: {
  href: string;
  name: string;
  email: string;
  image: string | null;
}) {
  return (
    <SettingsLink
      href={href}
      leading={<UserAvatar name={name} image={image} decorative />}
      title={name}
      subtitle={<span className="break-all">{email}</span>}
    />
  );
}

/**
 * "Mine klubber": every club, the active one with ✓; a tap on another opens
 * its Overblik, which makes it the active club (D-183). Then "Opret eller join
 * ny klub".
 */
export function MyClubsRows({
  clubs,
  activeId,
}: {
  clubs: readonly { id: string; name: string }[];
  activeId: string;
}) {
  return (
    <>
      {clubs.map((item) => {
        const active = item.id === activeId;
        return (
          <SettingsLink
            key={item.id}
            href={overviewHref(item.id)}
            aria-current={active ? "page" : undefined}
            leading={<ClubBadge name={item.name} size="sm" />}
            title={item.name}
            trailing={
              active ? (
                <CheckIcon aria-hidden className="size-5 shrink-0 text-highlight-ink" />
              ) : undefined
            }
          />
        );
      })}
      <SettingsLink
        href="/onboarding"
        icon={PlusIcon}
        title="Opret eller join ny klub"
        subtitle="Start en ny ølklub eller join med en kode"
      />
    </>
  );
}
