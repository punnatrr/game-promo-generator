"use client";

import { useId, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/classes";

interface TextareaFieldProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  id?: string;
  label: string;
  hint?: string;
  error?: string;
}

export function TextareaField({
  id,
  label,
  hint,
  error,
  className,
  required,
  ...props
}: TextareaFieldProps) {
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
      <textarea
        {...props}
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        className={cn(
          "ui-field w-full resize-y rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none transition placeholder:text-muted focus:border-white/50 focus-visible:ring-2 focus-visible:ring-purple-400/60 disabled:cursor-not-allowed disabled:opacity-55",
          error && "border-red-400/70",
          className
        )}
      />
      {hint && <p id={hintId} className="mt-1.5 text-xs text-muted">{hint}</p>}
      {error && <p id={errorId} className="mt-1.5 text-sm text-red-300">{error}</p>}
    </div>
  );
}
