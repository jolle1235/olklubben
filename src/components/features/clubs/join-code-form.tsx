"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INVALID_INVITE_CODE_MESSAGE, inviteCodeSchema } from "@/lib/validation/club";

/**
 * "Join en ølklub" (SPEC §7.2): type or paste a code (or a whole link). The
 * code is normalised here and the join page (/join/<CODE>) shows the club's
 * name and member count before anything is joined (§10.7).
 */
export function JoinCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = inviteCodeSchema.safeParse(code);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? INVALID_INVITE_CODE_MESSAGE);
      inputRef.current?.focus();
      return;
    }
    setError(null);
    startTransition(() => router.push(`/join/${parsed.data}`));
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3" noValidate>
      <div className="grid gap-2">
        <Label htmlFor={inputId}>Invitationskode</Label>
        <Input
          ref={inputRef}
          id={inputId}
          name="code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          placeholder="fx K7XM-Q2PA"
          className="font-semibold tracking-wider uppercase placeholder:font-normal placeholder:tracking-normal placeholder:normal-case"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${errorId} ${hintId}` : hintId}
        />
        {error ? <FieldError id={errorId}>{error}</FieldError> : null}
        <p id={hintId} className="text-[0.95rem] text-muted-foreground">
          Du kan også indsætte hele linket.
        </p>
      </div>
      <Button
        type="submit"
        variant="secondary"
        disabled={isPending}
        aria-busy={isPending || undefined}
      >
        {isPending ? <Loader2Icon aria-hidden className="animate-spin" /> : null}
        Join en ølklub
      </Button>
    </form>
  );
}
