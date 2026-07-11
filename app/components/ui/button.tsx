import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "@/app/components/ui/spinner";
import { cn } from "@/lib/classes";

type ButtonVariant = "primary" | "success" | "secondary";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  loadingLabel?: string;
  fullWidth?: boolean;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90",
  success: "bg-emerald-400 text-black hover:bg-emerald-300",
  secondary: "border border-white/15 bg-white/5 text-white hover:bg-white/10",
};

export function Button({
  variant = "primary",
  loading = false,
  loadingLabel = "กำลังดำเนินการ...",
  fullWidth = false,
  className,
  disabled,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-3 rounded-2xl px-5 py-3 font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none",
        VARIANT_CLASSES[variant],
        fullWidth && "w-full",
        className
      )}
    >
      {loading && <Spinner />}
      <span>{loading ? loadingLabel : children}</span>
    </button>
  );
}
