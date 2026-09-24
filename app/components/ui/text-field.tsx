"use client";

import { useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/classes";

interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  id?: string;
  label: string;
  hint?: string;
  error?: string;
}

export function TextField({
  id,
  label,
  hint,
  error,
  className,
  required,
  ...props
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <label htmlFor={inputId} className="mb-2 block text-sm font-medium text-white/70">
        {label}
        {required && <span className="ml-1 text-pink-300" aria-hidden="true">*</span>}
      </label>
      <input
        {...props}
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "ui-field w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none transition placeholder:text-muted focus:border-white/50 focus-visible:ring-2 focus-visible:ring-purple-400/60 disabled:cursor-not-allowed disabled:opacity-55",
          error && "border-red-400/70 focus:border-red-400 focus-visible:ring-red-400/40",
          className
        )}
      />
      {hint && <p id={descriptionId} className="mt-1.5 text-xs text-muted">{hint}</p>}
      {error && <p id={errorId} className="mt-1.5 text-sm text-red-300">{error}</p>}
    </div>
  );
}
