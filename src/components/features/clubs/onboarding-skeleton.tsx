import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for /clubs and /onboarding (SPEC §13.4: skeletons, not
 * spinners), rendered inside a CenteredShell without a title, so there is no
 * h1 yet and the olive band and logo stay put. Shaped like the page that is on
 * its way: "picker" is the club list, "onboarding" the create/join forms.
 */
export function OnboardingSkeleton({ variant }: { variant: "picker" | "onboarding" }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Henter …</span>
      <Skeleton className="h-9 w-3/4" />
      <Skeleton className="mt-2 mb-6 h-5 w-full" />

      {variant === "picker" ? (
        <>
          <div className="grid gap-3">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-16 rounded-xl" />
            ))}
          </div>
          <Skeleton className="mt-6 h-11 w-full" />
        </>
      ) : (
        <>
          <FormSectionSkeleton />
          <div className="my-7 flex items-center gap-4" aria-hidden>
            <span className="h-px flex-1 bg-border" />
            <span className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              eller
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <FormSectionSkeleton />
        </>
      )}
    </div>
  );
}

/** A heading, a line of help text, an input and its button. */
function FormSectionSkeleton() {
  return (
    <div>
      <Skeleton className="h-7 w-40" />
      <Skeleton className="mt-1 mb-4 h-5 w-5/6" />
      <div className="grid gap-3">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  );
}
