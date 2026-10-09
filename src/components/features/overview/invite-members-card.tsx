import { InviteShare } from "@/components/features/invite-share";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type InviteMembersCardProps = {
  /** Full join link, from inviteUrl(code) (server-only helper). */
  inviteUrl: string;
  /** The code as shown, from formatInviteCode(code), e.g. "K7XM-Q2PA". */
  displayCode: string;
  clubName: string;
  className?: string;
};

/**
 * "Inviter dine ølbrødre" (SPEC §7.2, §9.1): shown first on Overblik while the
 * club has only one member. A new club is no fun alone.
 */
export function InviteMembersCard({
  inviteUrl,
  displayCode,
  clubName,
  className,
}: InviteMembersCardProps) {
  return (
    <Card className={cn("border-amber/60 shadow-[0_10px_30px_-22px_rgb(65_68_55/0.6)]", className)}>
      <CardHeader>
        <h2 className="font-heading text-2xl leading-tight text-olive">Inviter dine ølbrødre</h2>
        <CardDescription className="text-[1.05rem]">
          En tom klub er ikke sjov. Del linket i gruppechatten.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <InviteShare
          inviteUrl={inviteUrl}
          displayCode={displayCode}
          clubName={clubName}
          className="[--ticket-notch:var(--card)]"
        />
      </CardContent>
    </Card>
  );
}
