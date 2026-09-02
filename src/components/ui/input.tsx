import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full min-w-0 max-w-full rounded-xl border border-[var(--color-border)] bg-black/30 px-4 py-2.5 text-sm text-white placeholder:text-[var(--color-muted)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-indigo-500/20 box-border",
        className
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-xl border border-[var(--color-border)] bg-black/30 px-4 py-2.5 text-sm text-white outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-indigo-500/20 cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block text-sm font-medium text-[var(--color-muted)] mb-1.5", className)}>
      {children}
    </label>
  );
}
