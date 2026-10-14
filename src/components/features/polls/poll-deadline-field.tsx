"use client";

import { InputField } from "@/components/features/forms/form-fields";

import type { DeadlineValue } from "./poll-form-state";

export type PollDeadlineFieldProps = {
  value: DeadlineValue;
  onChange: (value: DeadlineValue) => void;
  /** Today (Copenhagen): the date picker's minimum. */
  today?: string;
  hint: string;
  errors: { deadlineDate?: readonly string[]; deadlineTime?: readonly string[] };
};

/**
 * "Afstemningsfrist" (SPEC §9.7.1, §9.7.5): a date and a time side by side,
 * Copenhagen wall clock. Controlled: the create form lets it follow the first
 * date until it is touched (D-135); the edit form only allows a later one
 * (D-133, E24; the server decides).
 */
export function PollDeadlineField({
  value,
  onChange,
  today,
  hint,
  errors,
}: PollDeadlineFieldProps) {
  return (
    <fieldset className="grid min-w-0 grid-cols-1 gap-2">
      <legend className="mb-2 text-[0.95rem] leading-tight font-semibold text-ink">
        Afstemningsfrist
      </legend>
      <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:max-w-md">
        <InputField
          type="date"
          name="deadlineDate"
          label="Dato"
          value={value.date}
          min={today}
          onChange={(event) => onChange({ ...value, date: event.currentTarget.value })}
          required
          errors={errors.deadlineDate}
        />
        <InputField
          type="time"
          name="deadlineTime"
          label="Klokken"
          value={value.time}
          onChange={(event) => onChange({ ...value, time: event.currentTarget.value })}
          required
          errors={errors.deadlineTime}
        />
      </div>
      <p className="text-[0.95rem] text-muted-foreground">{hint}</p>
    </fieldset>
  );
}
