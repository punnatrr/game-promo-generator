"use client";

import Image from "next/image";
import { useId, useState, type ChangeEvent, type ReactNode } from "react";
import { cn } from "@/lib/classes";

interface FileUploadProps {
  name: string;
  label: string;
  description?: string;
  previewUrl?: string | null;
  previewAlt?: string;
  accept?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  maxSizeBytes?: number;
  onRejected?: (message: string) => void;
  onFileChange: (file?: File) => void;
  action?: ReactNode;
  className?: string;
}

export function FileUpload({
  name,
  label,
  description,
  previewUrl,
  previewAlt = "",
  accept = "image/png,image/jpeg,image/webp",
  required = false,
  disabled = false,
  error,
  maxSizeBytes,
  onRejected,
  onFileChange,
  action,
  className,
}: FileUploadProps) {
  const generatedId = useId();
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputId = `${generatedId}-${name}`;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const displayedError = error ?? validationError;
  const errorId = displayedError ? `${inputId}-error` : undefined;

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setValidationError(null);

    if (!file) {
      onFileChange(undefined);
      return;
    }

    const acceptedTypes = accept.split(",").map((value) => value.trim());
    const isAccepted = acceptedTypes.some((acceptedType) => {
      if (acceptedType.endsWith("/*")) {
        return file.type.startsWith(acceptedType.slice(0, -1));
      }
      if (acceptedType.startsWith(".")) {
        return file.name.toLowerCase().endsWith(acceptedType.toLowerCase());
      }
      return file.type === acceptedType;
    });

    let rejection: string | null = null;
    if (!isAccepted) {
      rejection = "ไฟล์ชนิดนี้ไม่รองรับ กรุณาเลือก PNG, JPG หรือ WEBP";
    } else if (maxSizeBytes && file.size > maxSizeBytes) {
      rejection = `ไฟล์มีขนาดเกิน ${Math.round(maxSizeBytes / 1024 / 1024)} MB`;
    }

    if (rejection) {
      event.target.value = "";
      setValidationError(rejection);
      onRejected?.(rejection);
      return;
    }

    onFileChange(file);
  }

  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        className={cn(
          "group flex min-h-28 cursor-pointer items-center gap-4 rounded-2xl border bg-black/30 p-4 transition focus-within:ring-2 focus-within:ring-purple-400/60",
          displayedError ? "border-red-400/70" : "border-white/10 hover:border-white/30 hover:bg-white/[0.06]",
          disabled && "cursor-not-allowed opacity-55"
        )}
      >
        <span className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/5">
          {previewUrl ? (
            <Image src={previewUrl} fill unoptimized sizes="80px" className="object-cover" alt={previewAlt} />
          ) : (
            <span className="text-2xl opacity-50" aria-hidden="true">＋</span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">
            {label}
            {required && <span className="ml-1 text-pink-300" aria-hidden="true">*</span>}
          </span>
          {description && (
            <span id={descriptionId} className="mt-1 block text-sm text-white/50">{description}</span>
          )}
          <span className="mt-2 block text-xs text-white/35">PNG, JPG หรือ WEBP</span>
        </span>
        {action && <span className="shrink-0">{action}</span>}
        <input
          id={inputId}
          name={name}
          type="file"
          accept={accept}
          required={required}
          disabled={disabled}
          onChange={handleChange}
          aria-invalid={displayedError ? true : undefined}
          aria-describedby={[descriptionId, errorId].filter(Boolean).join(" ") || undefined}
          className="sr-only"
        />
      </label>
      {displayedError && <p id={errorId} className="mt-1.5 text-sm text-red-300">{displayedError}</p>}
    </div>
  );
}
