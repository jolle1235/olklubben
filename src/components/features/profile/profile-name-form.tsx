"use client";

import { useId, useRef, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { toast } from "sonner";

import { FieldError } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { DEFAULT_ERROR_MESSAGES } from "@/lib/action-result";
import { updateProfileSchema } from "@/lib/validation/profile";
import { updateProfileName } from "@/server/actions/profile";

/**
 * "Basisprofil": change your name (SPEC §9.8, round 1). Validated with the same
 * Zod schema in the browser and in the Server Action. An error moves focus to
 * the field (SPEC §15.2).
 */
export function ProfileNameForm({ name: savedName }: { name: string }) {
  const [name, setName] = useState(savedName);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const errorId = `${inputId}-error`;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = updateProfileSchema.safeParse({ name });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? DEFAULT_ERROR_MESSAGES.VALIDATION);
      inputRef.current?.focus();
      return;
    }

    startTransition(async () => {
      try {
        const result = await updateProfileName(parsed.data);
        if (!result.ok) {
          setError(result.error.fieldErrors?.name?.[0] ?? result.error.message);
          inputRef.current?.focus();
          return;
        }
        setError(null);
        setName(result.data.name);
        toast.success("Gemt ✓");
      } catch (err) {
        // A stale session makes the action redirect to /login: let Next.js handle it.
        unstable_rethrow(err);
        console.error(err);
        toast.error(DEFAULT_ERROR_MESSAGES.UNEXPECTED);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={inputId}>Navn</Label>
        <Input
          ref={inputRef}
          id={inputId}
          name="name"
          autoComplete="name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (error) setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : `${inputId}-hint`}
        />
        {error ? (
          <FieldError id={errorId}>{error}</FieldError>
        ) : (
          <p id={`${inputId}-hint`} className="text-[0.95rem] text-muted-foreground">
            Sådan står du på medlemslisten i dine klubber.
          </p>
        )}
      </div>
      <SubmitButton
        pending={pending}
        pendingLabel="Gemmer …"
        className="self-stretch sm:self-start"
      >
        Gem navn
      </SubmitButton>
    </form>
  );
}
