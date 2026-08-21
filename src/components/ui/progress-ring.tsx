"use client";

import { formatHours } from "@/lib/calculations";
import { cn } from "@/lib/utils";

export function ProgressRing({
  value,
  max,
  size = 160,
  stroke = 10,
  label,
  sublabel,
  complete,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  label: string;
  sublabel?: string;
  complete?: boolean;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? Math.min(value / max, 1) : complete ? 1 : 0;
  const offset = circumference * (1 - pct);

  return (
    <div
      className={cn(
        "relative inline-flex flex-col items-center",
        complete && "goal-complete rounded-full"
      )}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(148,163,184,0.15)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={complete ? "var(--color-success)" : "var(--color-primary)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="progress-ring"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
        <span className="text-2xl font-bold tabular-nums">{label}</span>
        {sublabel && (
          <span className="text-xs text-[var(--color-muted)] mt-0.5">{sublabel}</span>
        )}
        <span className="text-[10px] text-[var(--color-muted)] mt-1">
          {Math.round(pct * 100)}% of goal
        </span>
      </div>
    </div>
  );
}

export function StatBadge({
  label,
  value,
  variant = "default",
}: {
  label: string;
  value: string;
  variant?: "default" | "success" | "warning";
}) {
  return (
    <div className="rounded-xl bg-black/30 border border-[var(--color-border)] px-4 py-3">
      <div className="text-xs text-[var(--color-muted)] uppercase tracking-wide">{label}</div>
      <div
        className={cn(
          "text-lg font-semibold mt-0.5 tabular-nums",
          variant === "success" && "text-[var(--color-success)]",
          variant === "warning" && "text-[var(--color-warning)]"
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function HoursDisplay({ ms }: { ms: number }) {
  return <>{formatHours(ms)}</>;
}
