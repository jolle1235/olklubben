"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";

import { FieldError, FormError } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { CLUB_NAME_MAX_LENGTH } from "@/lib/validation/club";
import { createClub } from "@/server/actions/clubs";

/**
 * "Opret ølklub" (SPEC §7.2): one field, the club's name. On success the
 * action redirects to the new club's Overblik.
 */
export function CreateClubForm() {
  const [state, formAction] = useActionState(createClub, null);
  // Controlled, so the name survives a failed submit (React resets uncontrolled forms).
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const errorId = useId();

  const failure = state && !state.ok ? state.error : null;
  const fieldError = failure?.fieldErrors?.name?.[0] ?? null;
  const formError = failure && !fieldError ? failure.message : null;

  // Focus the field after a field error (SPEC §15.2). `state` is a new object
  // per submit, so the same error twice in a row focuses it again.
  useEffect(() => {
    if (fieldError) inputRef.current?.focus();
  }, [state, fieldError]);

  return (
    <form action={formAction} className="grid gap-3">
      <div className="grid gap-2">
        <Label htmlFor={inputId}>Klubbens navn</Label>
        <Input
          ref={inputRef}
          id={inputId}
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={CLUB_NAME_MAX_LENGTH}
          autoComplete="off"
          placeholder="fx Drengene & Bajere"
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? errorId : undefined}
        />
        {fieldError ? <FieldError id={errorId}>{fieldError}</FieldError> : null}
      </div>
      {formError ? <FormError>{formError}</FormError> : null}
      <SubmitButton pendingLabel="Opretter klubben …">Opret ølklub</SubmitButton>
    </form>
  );
}
