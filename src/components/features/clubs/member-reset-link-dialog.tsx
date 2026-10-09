"use client";

import { useId, useRef, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { CopyIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormError } from "@/components/ui/form-message";
import { DEFAULT_ERROR_MESSAGES } from "@/lib/action-result";
import { createMemberResetLink } from "@/server/actions/clubs";

/**
 * Admin only: a one-time password reset link for a member (SPEC §6.4, D-017),
 * for when email is not set up. Explains first, creates the link on
 * confirmation, then shows it with a copy button.
 *
 * Controlled: opened from the member's '⋯' menu ("Lav nulstillingslink",
 * D-102) and rendered outside the menu, so the menu's focus handling and the
 * dialog's do not fight.
 */
export function MemberResetLinkDialog({
  clubId,
  userId,
  name,
  open,
  onOpenChange,
}: {
  clubId: string;
  userId: string;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const linkRef = useRef<HTMLInputElement>(null);
  const linkId = useId();

  function handleOpenChange(next: boolean) {
    if (isPending) return;
    onOpenChange(next);
    if (!next) {
      setLink(null);
      setError(null);
    }
  }

  function createLink() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await createMemberResetLink(clubId, userId);
        if (result.ok) setLink(result.data.url);
        else setError(result.error.message);
      } catch (err) {
        unstable_rethrow(err);
        console.error(err);
        setError(DEFAULT_ERROR_MESSAGES.UNEXPECTED);
      }
    });
  }

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link kopieret");
    } catch {
      linkRef.current?.focus();
      linkRef.current?.select();
      toast.error("Kunne ikke kopiere. Linket er markeret, så du kan kopiere det selv.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nulstillingslink til {name}</DialogTitle>
          <DialogDescription>
            {link
              ? `Linket virker i 1 time og kan kun bruges én gang. Del det kun med ${name}.`
              : `Har ${name} glemt sit password? Lav et engangslink, som ${name} kan bruge til at vælge et nyt. Linket virker i 1 time.`}
          </DialogDescription>
        </DialogHeader>

        {link ? (
          <div className="grid gap-2">
            <label htmlFor={linkId} className="text-[0.95rem] font-semibold text-ink">
              Nulstillingslink
            </label>
            {/* autoFocus: the new link gets focus (and is selected) as soon as it appears,
                instead of focus falling back to the dialog when "Lav link" is replaced. */}
            <input
              ref={linkRef}
              id={linkId}
              autoFocus
              readOnly
              value={link}
              onFocus={(event) => event.currentTarget.select()}
              className="h-11 w-full truncate rounded-lg bg-cream-deep px-3.5 text-[0.95rem] text-ink"
            />
          </div>
        ) : null}

        {error ? <FormError>{error}</FormError> : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isPending}>
              {link ? "Luk" : "Annuller"}
            </Button>
          </DialogClose>
          {link ? (
            <Button onClick={copyLink}>
              <CopyIcon aria-hidden />
              Kopiér link
            </Button>
          ) : (
            <Button onClick={createLink} disabled={isPending} aria-busy={isPending || undefined}>
              {isPending ? <Loader2Icon aria-hidden className="animate-spin" /> : null}
              {isPending ? "Laver link …" : "Lav link"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
