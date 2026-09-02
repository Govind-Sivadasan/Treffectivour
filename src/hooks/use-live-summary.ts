"use client";

import { calculateFromPunches, getEffectiveNowForDate } from "@/lib/calculations";
import type { DayType } from "@prisma/client";
import { useEffect, useMemo, useState } from "react";

export interface ApiDaySummary {
  date: string;
  effectiveMs: number;
  grossMs: number;
  effectiveHours: number;
  grossHours: number;
  requiredHours: number;
  dayType: string;
  isComplete: boolean;
  hasOpenSession?: boolean;
  recordId?: string;
  goalNotifiedAt?: string | null;
  notes?: string | null;
  scheduledSpecialDay?: { name: string; requiredHours: number } | null;
  punches: Array<{
    id: string;
    type: "IN" | "OUT";
    timestamp: string;
    isManual: boolean;
  }>;
  pairs: Array<{ in: string; out: string | null; durationMs: number }>;
}

function computeSummary(api: ApiDaySummary, now: Date): ApiDaySummary {
  const computed = calculateFromPunches(
    api.punches.map((p) => ({
      ...p,
      timestamp: new Date(p.timestamp),
    })),
    {
      date: api.date,
      dayType: api.dayType as DayType,
      requiredHours: api.requiredHours,
      now,
    }
  );

  return {
    ...api,
    effectiveMs: computed.effectiveMs,
    grossMs: computed.grossMs,
    effectiveHours: computed.effectiveHours,
    grossHours: computed.grossHours,
    isComplete: computed.isComplete,
    hasOpenSession: computed.hasOpenSession,
    pairs: computed.pairs.map((p) => ({
      in: p.in.toISOString(),
      out: p.out?.toISOString() ?? null,
      durationMs: p.durationMs,
    })),
  };
}

export function useLiveDaySummary(apiSummary: ApiDaySummary | null, live = true) {
  const [now, setNow] = useState(() => new Date());

  const hasOpenSession = useMemo(() => {
    if (!apiSummary?.punches.length) return false;
    const sorted = [...apiSummary.punches].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    return sorted.at(-1)?.type === "IN";
  }, [apiSummary]);

  useEffect(() => {
    if (!live) return;

    setNow(new Date());
    const ms = hasOpenSession ? 1000 : 30000;
    const interval = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(interval);
  }, [hasOpenSession, apiSummary?.punches, live]);

  const effectiveNow = useMemo(() => {
    if (!apiSummary) return new Date();
    if (!live) return getEffectiveNowForDate(apiSummary.date);
    return now;
  }, [apiSummary, live, now]);

  return useMemo(() => {
    if (!apiSummary) return null;
    return computeSummary(apiSummary, effectiveNow);
  }, [apiSummary, effectiveNow]);
}
