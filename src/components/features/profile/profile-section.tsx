import { Card, CardContent, CardHeader } from "@/components/ui/card";

export type ProfileSectionProps = {
  title: React.ReactNode;
  /** The heading's id. Given, the card is a region named by its heading. */
  headingId?: string;
  contentClassName?: string;
  children: React.ReactNode;
};

/** One card on Profil (SPEC §9.8): an h2 heading over its content. */
export function ProfileSection({
  title,
  headingId,
  contentClassName,
  children,
}: ProfileSectionProps) {
  return (
    <Card role={headingId ? "region" : undefined} aria-labelledby={headingId}>
      <CardHeader>
        <h2 id={headingId} className="font-heading text-title-sm text-primary-ink">
          {title}
        </h2>
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}
