"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { useId } from "react";

import { InputField } from "@/components/features/forms/form-fields";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { MAX_POLL_DATE_OPTIONS } from "@/server/domain/polls/options";

import {
  canAddDateRow,
  canRemoveDateRow,
  dateRowLabel,
  removeDateLabel,
  type DateRow,
} from "./poll-form-state";

export type PollDateRowsProps = {
  rows: readonly DateRow[];
  onAdd: () => void;
  onRemove: (key: string) => void;
  onChange: (key: string, date: string) => void;
  startTime: string;
  onStartTimeChange: (value: string) => void;
  /** Today (Copenhagen): the date pickers' minimum. */
  today: string;
  hint: string;
  errors: { dates?: readonly string[]; startTime?: readonly string[] };
};

/**
 * "Hvornår? (mindst én)" in the poll form (SPEC §9.7.1, D-134, D-135): one
 * native date field per candidate (`dates`, Copenhagen calendar days) with
 * its weekday beside it, ✕ per row (never the last), [+ Tilføj dato] (one
 * week after the latest, at most 10) and ONE start time for every date.
 */
export function PollDateRows({
  rows,
  onAdd,
  onRemove,
  onChange,
  startTime,
  onStartTimeChange,
  today,
  hint,
  errors,
}: PollDateRowsProps) {
  const baseId = useId();
  const error = errors.dates?.[0];
  const errorId = `${baseId}-error`;
  const hintId = `${baseId}-hint`;
  const canAdd = canAddDateRow(rows);
  const canRemove = canRemoveDateRow(rows);

  return (
    <fieldset
      className="grid min-w-0 grid-cols-1 gap-3"
      aria-describedby={error ? errorId : hintId}
    >
      <legend className="mb-2 text-[0.95rem] leading-tight font-semibold text-ink">
        Hvornår? <span className="font-normal text-muted-foreground">(mindst én)</span>
      </legend>
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}

      <ol className="grid grid-cols-1 gap-2.5">
        {rows.map((row, index) => {
          const inputId = `${baseId}-${row.key}`;
          const weekday = dateRowLabel(row.date);
          return (
            <li key={row.key} className="flex min-w-0 items-center gap-2 sm:gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <label htmlFor={inputId} className="sr-only">
                  Dato {index + 1}
                </label>
                <Input
                  type="date"
                  id={inputId}
                  name="dates"
                  value={row.date}
                  min={today}
                  data-row-key={row.key}
                  onChange={(event) => onChange(row.key, event.currentTarget.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                  className="sm:w-[11.5rem] sm:shrink-0"
                />
                {weekday ? (
                  <span
                    aria-hidden
                    className="min-w-0 pl-1 text-[0.95rem] break-words text-slate first-letter:uppercase sm:pl-0"
                  >
                    {weekday}
                  </span>
                ) : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemove(row.key)}
                disabled={!canRemove}
                aria-label={removeDateLabel(index, row.date)}
                className="shrink-0 self-start text-slate hover:text-danger sm:self-center"
              >
                <XIcon aria-hidden />
              </Button>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button type="button" variant="outline" onClick={onAdd} disabled={!canAdd}>
          <PlusIcon aria-hidden />
          Tilføj dato
        </Button>
        {canAdd ? null : (
          <span className="text-[0.95rem] text-muted-foreground">
            Højst {MAX_POLL_DATE_OPTIONS} datoer.
          </span>
        )}
      </div>

      <InputField
        type="time"
        name="startTime"
        label="Starttid for alle datoer"
        value={startTime}
        onChange={(event) => onStartTimeChange(event.currentTarget.value)}
        required
        errors={errors.startTime}
        className="mt-2 max-w-[12rem]"
      />

      <p id={hintId} className="text-[0.95rem] text-muted-foreground">
        {hint}
      </p>
    </fieldset>
  );
}
