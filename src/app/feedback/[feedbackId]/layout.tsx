import { requireFeedback } from "@/server/feedback/access";

/**
 * Guard for every page of one report (SPEC §9.9, D-065, D-148): logged in,
 * and the report exists, else a real HTTP 404 – unknown and malformed ids
 * alike. Reports are public to every user, so there is no other check here;
 * the edit page adds its own (canEditFeedback → 404). It sits above the
 * (detail) loading boundary, so notFound() runs before the response starts
 * streaming.
 *
 * Never writes (D-052): a Link prefetch renders layouts down to the nearest
 * loading.tsx. The pages call requireFeedback() again (cached per request).
 */
export default async function FeedbackReportLayout({
  children,
  params,
}: LayoutProps<"/feedback/[feedbackId]">) {
  const { feedbackId } = await params;
  await requireFeedback(feedbackId);
  return children;
}
