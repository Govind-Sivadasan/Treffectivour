"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

function playSuccessTone() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, ctx.currentTime);
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15);
    osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    // Audio not available
  }
}

interface SummaryLike {
  isComplete: boolean;
  effectiveHours: number;
  requiredHours: number;
  recordId?: string;
  goalNotifiedAt?: string | Date | null;
}

export function useGoalNotification(summary: SummaryLike | null) {
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (!summary?.isComplete) {
      notifiedRef.current = false;
      return;
    }

    if (summary.goalNotifiedAt || notifiedRef.current) return;

    notifiedRef.current = true;
    playSuccessTone();
    toast.success("Goal reached!", {
      description: `${summary.effectiveHours}h effective of ${summary.requiredHours}h required`,
      duration: 8000,
    });

    if (summary.recordId) {
      fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: summary.recordId }),
      }).catch(() => {});
    }
  }, [summary]);
}
