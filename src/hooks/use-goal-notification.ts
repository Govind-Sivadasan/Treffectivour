"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { playSuccessTone, unlockAudio } from "@/lib/success-tone";

interface SummaryLike {
  isComplete: boolean;
  effectiveHours: number;
  requiredHours: number;
  recordId?: string;
  goalNotifiedAt?: string | Date | null;
}

export function useGoalNotification(summary: SummaryLike | null) {
  const prevCompleteRef = useRef(false);
  const notifyingRef = useRef(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    const onInteract = () => unlockAudio();
    window.addEventListener("pointerdown", onInteract, { once: true });
    window.addEventListener("keydown", onInteract, { once: true });
    return () => {
      window.removeEventListener("pointerdown", onInteract);
      window.removeEventListener("keydown", onInteract);
    };
  }, []);

  useEffect(() => {
    if (!summary) {
      prevCompleteRef.current = false;
      initializedRef.current = false;
      return;
    }

    if (!initializedRef.current) {
      initializedRef.current = true;
      prevCompleteRef.current = summary.isComplete;
      return;
    }

    const justCompleted =
      summary.isComplete && !prevCompleteRef.current && !summary.goalNotifiedAt;

    prevCompleteRef.current = summary.isComplete;

    if (!justCompleted || notifyingRef.current) return;

    notifyingRef.current = true;

    void playSuccessTone();
    toast.success("Daily goal reached!", {
      description: `${summary.effectiveHours}h effective of ${summary.requiredHours}h required`,
      duration: 8000,
    });

    if (summary.recordId) {
      fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: summary.recordId }),
      })
        .catch(() => {})
        .finally(() => {
          notifyingRef.current = false;
        });
    } else {
      notifyingRef.current = false;
    }
  }, [summary]);
}

interface WeekStatsLike {
  isWeeklyTargetMet?: boolean;
  totalEffectiveMs?: number;
  weeklyTargetMs?: number;
}

export function useWeeklyGoalNotification(
  stats: WeekStatsLike | null,
  enabled: boolean
) {
  const prevMetRef = useRef(false);
  const notifiedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !stats?.isWeeklyTargetMet) {
      if (!stats?.isWeeklyTargetMet) prevMetRef.current = false;
      return;
    }

    const weekKey = new Date().toISOString().slice(0, 10);
    const justMet = !prevMetRef.current;
    prevMetRef.current = true;

    if (!justMet || notifiedKeyRef.current === weekKey) return;
    notifiedKeyRef.current = weekKey;

    void playSuccessTone();
    const effective = ((stats.totalEffectiveMs ?? 0) / 3600000).toFixed(1);
    toast.success("Weekly 40h goal reached!", {
      description: `${effective}h effective (Mon–Fri, Sat/Sun excluded)`,
      duration: 10000,
    });
  }, [stats, enabled]);
}
