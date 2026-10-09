import { CenteredShell } from "@/components/features/centered-shell";
import { OnboardingSkeleton } from "@/components/features/clubs/onboarding-skeleton";

/** Loading state for the club picker (SPEC §13.4). */
export default function ClubsLoading() {
  return (
    <CenteredShell>
      <OnboardingSkeleton variant="picker" />
    </CenteredShell>
  );
}
