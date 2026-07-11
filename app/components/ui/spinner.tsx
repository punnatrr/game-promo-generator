import { cn } from "@/lib/classes";

interface SpinnerProps {
  className?: string;
  label?: string;
}

export function Spinner({ className, label }: SpinnerProps) {
  return (
    <span
      className="inline-flex"
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-5 w-5 animate-spin rounded-full border-2 border-current/25 border-t-current motion-reduce:animate-none",
          className
        )}
      />
    </span>
  );
}
