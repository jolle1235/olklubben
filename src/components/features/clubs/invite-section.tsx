import { InviteShare } from "@/components/features/invite-share";
import { cn } from "@/lib/utils";

import { RegenerateInviteButton } from "./regenerate-invite-button";

export type InviteSectionProps = {
  clubId: string;
  clubName: string;
  /** From inviteUrl(code) and formatInviteCode(code); null when the club has no active code. */
  invite: { url: string; displayCode: string } | null;
  /** canRegenerateInvite(membership): admins only. */
  canRegenerate: boolean;
  className?: string;
};

/**
 * The club's invitation on the club page (SPEC §7.3, §9.8, Q9): every member
 * may see and share it; only admins can replace the code.
 */
export function InviteSection({
  clubId,
  clubName,
  invite,
  canRegenerate,
  className,
}: InviteSectionProps) {
  return (
    <section id="invite" aria-labelledby="invite-heading" className={cn("scroll-mt-24", className)}>
      <h2 id="invite-heading" className="text-2xl text-olive">
        Inviter dine ølbrødre
      </h2>
      <p className="mt-1 mb-4 text-[1.05rem] text-muted-foreground">
        Alle i klubben må dele linket. Den, der åbner det, kan joine med det samme.
      </p>

      {invite ? (
        <InviteShare inviteUrl={invite.url} displayCode={invite.displayCode} clubName={clubName} />
      ) : (
        <p className="rounded-2xl border-2 border-dashed border-border bg-paper/60 px-5 py-6 text-center text-[1.05rem] text-muted-foreground">
          {canRegenerate
            ? "Klubben har ingen aktiv invitationskode lige nu."
            : "Klubben har ingen aktiv invitationskode lige nu. Spørg en admin om at lave en ny."}
        </p>
      )}

      {canRegenerate ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <RegenerateInviteButton clubId={clubId} hasInvite={invite !== null} />
          {invite ? (
            <p className="text-[0.95rem] text-muted-foreground">
              Er linket havnet de forkerte steder? Så lav en ny kode.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
