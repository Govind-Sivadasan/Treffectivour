"use client";

import { Button } from "@/components/ui/button";
import { DayDatePicker } from "@/components/dashboard/day-date-picker";
import { ManualEntry } from "@/components/dashboard/manual-entry";
import { OcrUpload } from "@/components/dashboard/ocr-upload";
import { PeriodDashboard } from "@/components/dashboard/period-dashboard";
import { TodayPanel } from "@/components/dashboard/today-panel";
import { useGoalNotification, useWeeklyGoalNotification } from "@/hooks/use-goal-notification";
import { useLiveDaySummary, type ApiDaySummary } from "@/hooks/use-live-summary";
import { getDateKey } from "@/lib/calculations";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Calendar,
  LayoutDashboard,
  LogOut,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface User {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
}

type Tab = "today" | "week" | "month";

export function DashboardApp({ user }: { user: User }) {
  const [tab, setTab] = useState<Tab>("today");
  const [todaySummary, setTodaySummary] = useState<ApiDaySummary | null>(null);
  const [weekStats, setWeekStats] = useState<Record<string, unknown> | null>(null);
  const [monthStats, setMonthStats] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const todayDate = getDateKey();
  const [selectedDate, setSelectedDate] = useState(todayDate);
  const isViewingToday = selectedDate === todayDate;

  const fetchDay = useCallback(async (date: string) => {
    const res = await fetch(`/api/dashboard?period=today&date=${date}`);
    const data = await res.json();
    setTodaySummary(data.summary ?? null);
  }, []);

  const fetchPeriods = useCallback(async () => {
    const [weekRes, monthRes] = await Promise.all([
      fetch("/api/dashboard?period=week"),
      fetch("/api/dashboard?period=month"),
    ]);
    const weekData = await weekRes.json();
    const monthData = await monthRes.json();
    setWeekStats(weekData.stats ?? null);
    setMonthStats(monthData.stats ?? null);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchDay(selectedDate), fetchPeriods()]);
    setLoading(false);
  }, [fetchDay, fetchPeriods, selectedDate]);

  useEffect(() => {
    setLoading(true);
    fetchDay(selectedDate).finally(() => setLoading(false));
  }, [selectedDate, fetchDay]);

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  useEffect(() => {
    if (!isViewingToday) return;
    const interval = setInterval(() => fetchDay(selectedDate), 30000);
    return () => clearInterval(interval);
  }, [fetchDay, selectedDate, isViewingToday]);

  const liveDaySummary = useLiveDaySummary(todaySummary, isViewingToday);

  useGoalNotification(isViewingToday ? liveDaySummary : null);
  useWeeklyGoalNotification(
    weekStats as { isWeeklyTargetMet?: boolean; totalEffectiveMs?: number; weeklyTargetMs?: number } | null,
    tab === "week"
  );

  async function logout() {
    await fetch("/api/auth/login", { method: "DELETE" });
    window.location.href = "/login";
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "today", label: "Today", icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: "week", label: "Weekly", icon: <Calendar className="w-4 h-4" /> },
    { id: "month", label: "Monthly", icon: <BarChart3 className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 glass border-b border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              Treffectivour
            </h1>
            <p className="text-xs text-[var(--color-muted)]">Effective hours tracker</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--color-muted)] hidden sm:inline">
              {user.name}
            </span>
            {user.role === "ADMIN" && (
              <Link href="/admin">
                <Button variant="secondary" size="sm">
                  <Shield className="w-4 h-4" />
                  Admin
                </Button>
              </Link>
            )}
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex gap-2 p-1 rounded-xl bg-black/30 border border-[var(--color-border)] w-fit">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition",
                tab === t.id
                  ? "bg-[var(--color-primary)] text-white shadow-lg"
                  : "text-[var(--color-muted)] hover:text-white hover:bg-white/5"
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {tab === "today" && (
          <div className="space-y-4">
            <DayDatePicker
              value={selectedDate}
              onChange={setSelectedDate}
              max={todayDate}
            />
            {!isViewingToday && (
              <p className="text-sm text-[var(--color-muted)]">
                Viewing a past day — edit punches, add a missing OUT, or import a screenshot for this date.
              </p>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">
              <TodayPanel
                summary={liveDaySummary}
                loading={loading}
                onRefresh={refresh}
                isToday={isViewingToday}
              />
              <div className="space-y-6 min-w-0">
                <OcrUpload date={selectedDate} onSuccess={refresh} />
                <ManualEntry date={selectedDate} onSuccess={refresh} />
              </div>
            </div>
          </div>
        )}

        {tab === "week" && (
          <PeriodDashboard
            title="This week"
            stats={weekStats as Parameters<typeof PeriodDashboard>[0]["stats"]}
            loading={loading}
            mode="week"
          />
        )}

        {tab === "month" && (
          <PeriodDashboard
            title="This month"
            stats={monthStats as Parameters<typeof PeriodDashboard>[0]["stats"]}
            loading={loading}
            mode="month"
          />
        )}
      </main>
    </div>
  );
}
