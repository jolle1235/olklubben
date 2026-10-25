import { InviteShare } from "@/components/features/invite-share";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
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
 * "Inviter dine ølbrødre" on the club page (SPEC §7.3, §9.8, Q9, D-163): the
 * invitation as a card with the boarding pass. Every member may see and share
 * it; only admins can replace the code.
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
      <Card className="border-amber/60 shadow-[0_10px_30px_-22px_rgb(65_68_55/0.6)]">
        <CardHeader>
          <h2 id="invite-heading" className="font-heading text-2xl leading-tight text-olive">
            Inviter dine ølbrødre
          </h2>
          <CardDescription className="text-[1.05rem]">
            En tom klub er ikke sjov. Del linket i gruppechatten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invite ? (
            <InviteShare
              inviteUrl={invite.url}
              displayCode={invite.displayCode}
              clubName={clubName}
              className="[--ticket-notch:var(--card)]"
            />
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
        </CardContent>
      </Card>
    </section>
  );
}
