"use client";

import { useId } from "react";
import { cn } from "@/lib/classes";

type RadioValue = string | number;

export interface RadioOption<T extends RadioValue> {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface RadioGroupProps<T extends RadioValue> {
  name: string;
  label: string;
  value: T;
  options: readonly RadioOption<T>[];
  onValueChange: (value: T) => void;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  className?: string;
  columns?: 1 | 2 | 3 | 4 | 5;
}

const COLUMN_CLASSES = {
  1: "grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-5",
} as const;

export function RadioGroup<T extends RadioValue>({
  name,
  label,
  value,
  options,
  onValueChange,
  disabled = false,
  required = false,
  error,
  className,
  columns = 2,
}: RadioGroupProps<T>) {
  const groupId = useId();
  const errorId = error ? `${groupId}-error` : undefined;

  return (
    <fieldset disabled={disabled} aria-describedby={errorId} className={className}>
      <legend className="mb-2 text-sm font-medium text-white/70">
        {label}
        {required && <span className="ml-1 text-pink-300" aria-hidden="true">*</span>}
      </legend>
      <div className={cn("grid gap-2", COLUMN_CLASSES[columns])}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <label
              key={option.value}
              className={cn(
                "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition focus-within:ring-2 focus-within:ring-purple-400/60",
                selected
                  ? "border-white/40 bg-white/10"
                  : "border-transparent hover:bg-white/[0.06]",
                (disabled || option.disabled) && "cursor-not-allowed opacity-50"
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                required={required}
                disabled={option.disabled}
                onChange={() => onValueChange(option.value)}
                className="h-4 w-4 accent-white"
              />
              <span>
                <span className="font-medium text-white/90">{option.label}</span>
                {option.description && (
                  <span className="ml-2 text-white/45">{option.description}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>
      {error && <p id={errorId} className="mt-1.5 text-sm text-red-300">{error}</p>}
    </fieldset>
  );
}
