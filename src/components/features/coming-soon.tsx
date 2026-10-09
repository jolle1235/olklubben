import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export type ComingSoonProps = {
  /** The page's title (its only <h1>), e.g. "Kalender". */
  title: string;
  /** Lucide icon element or emoji, shown in a porthole. */
  icon: React.ReactNode;
  /** The friendly headline, e.g. "Kalenderen er ved at blive tappet 📅". */
  headline: React.ReactNode;
  description?: React.ReactNode;
  /** Optional way on, e.g. a link back to Overblik. */
  actions?: React.ReactNode;
};

/**
 * A page that is not built yet (SPEC §16.3: Kalender, Øl and Sangbog may be
 * placeholders). Keeps the navigation working and says, kindly, that it is on
 * its way.
 */
export function ComingSoon({ title, icon, headline, description, actions }: ComingSoonProps) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState icon={icon} title={headline} description={description} actions={actions} />
    </>
  );
}
