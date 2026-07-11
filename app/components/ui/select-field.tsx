"use client";

import { useId, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/classes";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface SelectFieldProps<T extends string>
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "value" | "onChange"> {
  id?: string;
  label: string;
  hint?: string;
  error?: string;
  value: T;
  options: readonly SelectOption<T>[];
  onValueChange: (value: T) => void;
}

export function SelectField<T extends string>({
  id,
  label,
  hint,
  error,
  value,
  options,
  onValueChange,
  className,
  required,
  ...props
}: SelectFieldProps<T>) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div>
      <label htmlFor={inputId} className="mb-2 block text-sm font-medium text-white/70">
        {label}
        {required && <span className="ml-1 text-pink-300" aria-hidden="true">*</span>}
      </label>
      <select
        {...props}
        id={inputId}
        required={required}
        value={value}
        onChange={(event) => onValueChange(event.target.value as T)}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        className={cn(
          "w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none transition focus:border-white/50 focus-visible:ring-2 focus-visible:ring-purple-400/60 disabled:cursor-not-allowed disabled:opacity-55",
          error && "border-red-400/70",
          className
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && <p id={hintId} className="mt-1.5 text-xs text-white/45">{hint}</p>}
      {error && <p id={errorId} className="mt-1.5 text-sm text-red-300">{error}</p>}
    </div>
  );
}
