import { CenteredShell } from "@/components/features/centered-shell";
import { OnboardingSkeleton } from "@/components/features/clubs/onboarding-skeleton";

/** Loading state for onboarding: create or join a club (SPEC §13.4). */
export default function OnboardingLoading() {
  return (
    <CenteredShell>
      <OnboardingSkeleton variant="onboarding" />
    </CenteredShell>
  );
}
