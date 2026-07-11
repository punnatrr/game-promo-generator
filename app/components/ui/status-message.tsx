import type { ReactNode } from "react";
import { cn } from "@/lib/classes";

type StatusTone = "info" | "loading" | "success" | "error";

interface StatusMessageProps {
  tone?: StatusTone;
  title?: string;
  children: ReactNode;
  className?: string;
}

const TONE_CLASSES: Record<StatusTone, string> = {
  info: "border-blue-400/20 bg-blue-400/10 text-blue-100",
  loading: "border-yellow-400/20 bg-yellow-400/10 text-yellow-100",
  success: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
  error: "border-red-400/25 bg-red-400/10 text-red-100",
};

export function StatusMessage({
  tone = "info",
  title,
  children,
  className,
}: StatusMessageProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={cn("rounded-2xl border p-4 text-sm", TONE_CLASSES[tone], className)}
    >
      {title && <p className="font-semibold">{title}</p>}
      <div className={cn(title && "mt-1")}>{children}</div>
    </div>
  );
}
