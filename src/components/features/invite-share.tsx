"use client";

import { useId, useRef } from "react";
import { CopyIcon, Share2Icon } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type InviteShareProps = {
  /** Full join link, e.g. https://…/join/K7XMQ2PA (SPEC §7.3). */
  inviteUrl: string;
  /** The code as shown to people, e.g. "K7XM-Q2PA". */
  displayCode: string;
  /** Used in the share text when given. */
  clubName?: string;
  className?: string;
};

/**
 * The club's invitation as a little boarding pass: the code big and readable,
 * the link, "Kopiér link" and "Del" (Web Share API on mobile, falls back to copy).
 * Used on the onboarding/overview card "Inviter dine ølbrødre" and on the club page.
 * Inside a card, match the ticket notches to the card: className="[--ticket-notch:var(--card)]".
 */
export function InviteShare({ inviteUrl, displayCode, clubName, className }: InviteShareProps) {
  const linkRef = useRef<HTMLInputElement>(null);
  const linkId = useId();

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success("Link kopieret 🍻");
    } catch {
      // No clipboard (fx http on a LAN address): select the link so it can be copied by hand.
      linkRef.current?.focus();
      linkRef.current?.select();
      toast.error("Kunne ikke kopiere. Linket er markeret, så du kan kopiere det selv.");
    }
  }

  async function share() {
    const text = clubName
      ? `Kom med i ${clubName} på Ølklubben 🍺 Koden er ${displayCode}.`
      : `Kom med i vores ølklub 🍺 Koden er ${displayCode}.`;

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Invitation til Ølklubben", text, url: inviteUrl });
        return;
      } catch (error) {
        // The user closed the share sheet: nothing to do.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copyLink();
  }

  return (
    <div
      className={cn(
        "relative rounded-2xl border border-border bg-paper text-ink [--ticket-notch:var(--background)]",
        className,
      )}
    >
      <div className="px-5 pt-5 pb-4 text-center">
        <p className="text-sm font-semibold text-muted-foreground">Invitationskode</p>
        <p className="mt-1.5 font-display text-[clamp(1.9rem,9.5vw,3rem)] leading-none font-bold tracking-[0.06em] whitespace-nowrap text-olive tabular-nums">
          <span aria-hidden>{displayCode}</span>
          <span className="sr-only">{displayCode.split("").join(" ")}</span>
        </p>
      </div>

      {/* Perforation with a notch on each side, like a ticket stub. */}
      <div aria-hidden className="relative flex items-center">
        <span className="absolute -left-3 size-6 rounded-full border border-border bg-(--ticket-notch) [clip-path:inset(0_0_0_50%)]" />
        <span className="mx-5 w-full border-t-2 border-dashed border-border" />
        <span className="absolute -right-3 size-6 rounded-full border border-border bg-(--ticket-notch) [clip-path:inset(0_50%_0_0)]" />
      </div>

      <div className="flex flex-col gap-3 p-5">
        <label className="sr-only" htmlFor={linkId}>
          Invitationslink
        </label>
        <input
          ref={linkRef}
          id={linkId}
          readOnly
          value={inviteUrl}
          onFocus={(event) => event.currentTarget.select()}
          className="h-11 w-full truncate rounded-lg bg-cream-deep px-3.5 text-[0.95rem] text-ink"
        />
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="secondary" onClick={copyLink}>
            <CopyIcon aria-hidden />
            Kopiér link
          </Button>
          <Button type="button" onClick={share}>
            <Share2Icon aria-hidden />
            Del
          </Button>
        </div>
      </div>
    </div>
  );
}
