"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { ProgressRing, StatBadge } from "@/components/ui/progress-ring";
import { formatDurationWithSeconds, formatHours, getLeaveTimeInfo } from "@/lib/calculations";
import { formatDate, formatTime } from "@/lib/utils";
import { LogIn } from "lucide-react";
import { PunchEditRow } from "@/components/dashboard/punch-edit-row";
import { RequiredHoursControl } from "@/components/dashboard/required-hours-control";
import { useState } from "react";
import { toast } from "sonner";
import type { ApiDaySummary } from "@/hooks/use-live-summary";

interface TodayPanelProps {
  summary: ApiDaySummary | null;
  loading: boolean;
  onRefresh: () => void;
}

export function TodayPanel({ summary, loading, onRefresh }: TodayPanelProps) {
  async function deletePunch(punchId: string) {
    if (!summary) return;
    const res = await fetch(
      `/api/entries?punchId=${punchId}&date=${summary.date}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      toast.success("Punch removed");
      onRefresh();
    } else {
      toast.error("Failed to remove punch");
    }
  }

  if (loading || !summary) {
    return (
      <Card glow className="col-span-full lg:col-span-2">
        <div className="animate-pulse h-64 rounded-xl bg-white/5" />
      </Card>
    );
  }

  const leave = getLeaveTimeInfo(summary, new Date());
  const leaveLabel =
    leave.status === "leave_day"
      ? "Can leave"
      : leave.status === "now"
        ? "Can leave since"
        : leave.status === "scheduled"
          ? "Can leave at"
          : "Can leave at";
  const leaveValue =
    leave.status === "leave_day"
      ? "Anytime"
      : leave.status === "clock_in"
        ? "Clock in first"
        : leave.at
          ? formatTime(leave.at)
          : "—";

  return (
    <Card glow className="col-span-full lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <CardTitle>Today — {formatDate(summary.date)}</CardTitle>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            {summary.dayType === "FULL_DAY_LEAVE" && "Full day leave (0h) · "}
            {summary.dayType === "HALF_DAY_LEAVE" && "Half day leave (4h) · "}
            {summary.dayType === "SPECIAL" && "Custom target · "}
            Default is 8h — change Required (h) to customize
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <RequiredHoursControl
            date={summary.date}
            value={summary.requiredHours}
            dayType={summary.dayType}
            scheduledSpecialDay={summary.scheduledSpecialDay}
            onUpdated={onRefresh}
          />
          <Button variant="secondary" size="sm" onClick={onRefresh}>
            Refresh
          </Button>
          {summary.isComplete && (
            <span className="px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 text-sm font-medium">
              Goal met
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-8">
        <ProgressRing
          value={summary.effectiveMs}
          max={summary.requiredHours * 3600000}
          label={formatHours(summary.effectiveMs)}
          sublabel="Effective"
          complete={summary.isComplete}
        />

        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full min-w-0">
          <StatBadge
            label="Gross"
            hint={summary.hasOpenSession ? "1st IN → now" : "1st IN → last OUT"}
            value={formatHours(summary.grossMs)}
          />
          {summary.hasOpenSession && (
            <p className="col-span-1 sm:col-span-2 text-[11px] text-[var(--color-accent)] -mt-1">
              Gross spans from first clock-in to current time · effective excludes breaks
            </p>
          )}
          <StatBadge
            label="Remaining"
            value={formatDurationWithSeconds(
              Math.max(0, summary.requiredHours * 3600000 - summary.effectiveMs)
            )}
            variant={summary.isComplete ? "success" : "warning"}
          />
          <StatBadge
            label={leaveLabel}
            value={leaveValue}
            variant={
              leave.status === "leave_day" || leave.status === "now"
                ? "success"
                : leave.status === "scheduled"
                  ? "warning"
                  : "default"
            }
          />
          <StatBadge label="Required" value={`${summary.requiredHours}h`} />
          <StatBadge label="Punches" value={String(summary.punches.length)} />
        </div>
      </div>

      <div className="mt-6 space-y-2">
        <h4 className="text-sm font-medium text-[var(--color-muted)]">Punch log</h4>
        {summary.punches.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)] py-4 text-center">
            No punches yet. Upload a screenshot or add manually.
          </p>
        ) : (
          summary.punches.map((p) => (
            <PunchEditRow
              key={p.id}
              punch={p}
              date={summary.date}
              onSave={onRefresh}
              onDelete={() => deletePunch(p.id)}
            />
          ))
        )}
      </div>

      {(summary.hasOpenSession || summary.pairs.some((p) => !p.out)) && (
        <p className="mt-4 text-xs text-[var(--color-accent)]">
          Open session — OUT missing. Effective and gross count automatically to the current time.
        </p>
      )}
    </Card>
  );
}

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Login failed");
        return;
      }
      toast.success(`Welcome, ${data.user.name}`);
      window.location.href = "/dashboard";
    } catch {
      toast.error("Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card glow className="w-full max-w-md">
      <CardTitle className="flex items-center gap-2 mb-6">
        <LogIn className="w-5 h-5" />
        Sign in to Treffectivour
      </CardTitle>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm text-[var(--color-muted)]">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full mt-1 rounded-xl border border-[var(--color-border)] bg-black/30 px-4 py-2.5 text-sm"
            placeholder="user@treffectivour.local"
            required
          />
        </div>
        <div>
          <label className="text-sm text-[var(--color-muted)]">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mt-1 rounded-xl border border-[var(--color-border)] bg-black/30 px-4 py-2.5 text-sm"
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </Card>
  );
}
