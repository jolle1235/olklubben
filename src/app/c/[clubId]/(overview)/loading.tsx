import { OverviewSkeleton } from "@/components/features/overview/overview-skeleton";

/**
 * Loading state for Overblik (SPEC §13.4), shaped like the hero and the
 * upcoming list. Inside the (overview) group, so it wraps only Overblik: a
 * loading.tsx directly in c/[clubId] would wrap every club page and turn their
 * notFound() into a soft 404 (TG-008).
 */
export default function OverviewLoading() {
  return <OverviewSkeleton />;
}
