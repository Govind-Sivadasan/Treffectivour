"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { StatBadge } from "@/components/ui/progress-ring";
import { formatDurationWithSeconds, formatHours } from "@/lib/calculations";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface PeriodStats {
  totalEffectiveMs: number;
  totalGrossMs: number;
  totalRequiredMs: number;
  daysTracked: number;
  daysComplete: number;
  workDaysInRange?: number;
  weeklyTargetMs?: number;
  isWeeklyTargetMet?: boolean;
  remainingToTargetMs?: number;
  daily: Array<{
    date: string;
    effectiveHours: number;
    requiredHours: number;
    isComplete: boolean;
  }>;
}

export function PeriodDashboard({
  title,
  stats,
  loading,
  mode = "week",
}: {
  title: string;
  stats: PeriodStats | null;
  loading: boolean;
  mode?: "week" | "month";
}) {
  if (loading || !stats) {
    return (
      <Card>
        <div className="animate-pulse h-48 rounded-xl bg-white/5" />
      </Card>
    );
  }

  const chartData = stats.daily
    .filter((d) => d.effectiveHours > 0)
    .map((d) => ({
      date: d.date.slice(5),
      effective: d.effectiveHours,
      required: d.requiredHours,
    }));

  const isWeek = mode === "week";
  const weeklyTargetMs = stats.weeklyTargetMs ?? 40 * 3600000;
  const weeklyMet = stats.isWeeklyTargetMet ?? false;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <CardTitle>{title}</CardTitle>
        {isWeek && weeklyMet && (
          <span className="px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 text-sm font-medium">
            40h weekly goal met
          </span>
        )}
      </div>

      {isWeek && (
        <p className="text-xs text-[var(--color-muted)] mb-4">
          Mon–Fri only · Sat/Sun excluded · Target {weeklyTargetMs / 3600000}h effective
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatBadge label="Effective (work days)" value={formatHours(stats.totalEffectiveMs)} />
        <StatBadge label="Gross total" value={formatHours(stats.totalGrossMs)} />
        {isWeek ? (
          <StatBadge
            label="Remaining to 40h"
            value={formatDurationWithSeconds(stats.remainingToTargetMs ?? 0)}
            variant={weeklyMet ? "success" : "warning"}
          />
        ) : (
          <StatBadge
            label="Required (work days)"
            value={formatHours(stats.totalRequiredMs)}
          />
        )}
        <StatBadge
          label="Work days complete"
          value={`${stats.daysComplete}/${stats.workDaysInRange ?? stats.daysTracked}`}
          variant={
            stats.daysComplete === (stats.workDaysInRange ?? stats.daysTracked)
              ? "success"
              : "default"
          }
        />
      </div>

      {chartData.length > 0 ? (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "#111827",
                  border: "1px solid #1e293b",
                  borderRadius: 12,
                }}
              />
              <Bar dataKey="effective" fill="#6366f1" radius={[6, 6, 0, 0]} name="Effective (h)" />
              <Bar dataKey="required" fill="#22d3ee" radius={[6, 6, 0, 0]} name="Required (h)" opacity={0.5} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-sm text-[var(--color-muted)] text-center py-8">
          No data for this period yet.
        </p>
      )}
    </Card>
  );
}
