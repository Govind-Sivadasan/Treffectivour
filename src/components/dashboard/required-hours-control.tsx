"use client";

import { Input, Label } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface RequiredHoursControlProps {
  date: string;
  value: number;
  dayType: string;
  scheduledSpecialDay?: { name: string; requiredHours: number } | null;
  onUpdated: () => void;
}

export function RequiredHoursControl({
  date,
  value,
  dayType,
  scheduledSpecialDay,
  onUpdated,
}: RequiredHoursControlProps) {
  const [hours, setHours] = useState(String(value));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setHours(String(value));
  }, [value]);

  async function save(next?: string) {
    const parsed = parseFloat(next ?? hours);
    if (Number.isNaN(parsed) || parsed <= 0 || parsed > 24) {
      toast.error("Enter required hours between 0.5 and 24");
      setHours(String(value));
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/entries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          requiredHours: parsed,
          dayType: parsed === 4 ? "HALF_DAY_LEAVE" : parsed === 8 ? "FULL" : "SPECIAL",
        }),
      });
      if (!res.ok) {
        toast.error("Failed to update required hours");
        setHours(String(value));
        return;
      }
      toast.success("Required hours updated");
      onUpdated();
    } catch {
      toast.error("Failed to update required hours");
      setHours(String(value));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-end gap-2">
        <div className="w-28">
          <Label className="text-[10px] uppercase tracking-wide">Required (h)</Label>
          <Input
            type="number"
            step="0.5"
            min="0.5"
            max="24"
            value={hours}
            disabled={saving}
            onChange={(e) => setHours(e.target.value)}
            onBlur={() => {
              if (hours !== String(value)) save();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                save();
              }
            }}
            className="py-2 text-center font-semibold tabular-nums"
          />
        </div>
        {dayType === "HALF_DAY_LEAVE" && (
          <span className="text-[10px] text-[var(--color-muted)] pb-2.5">half day</span>
        )}
        {value !== 8 && (
          <button
            type="button"
            onClick={() => {
              setHours("8");
              save("8");
            }}
            className="text-[10px] text-[var(--color-muted)] hover:text-white pb-2.5 underline-offset-2 hover:underline"
          >
            Reset to 8h
          </button>
        )}
      </div>
      {scheduledSpecialDay && value !== scheduledSpecialDay.requiredHours && (
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setHours(String(scheduledSpecialDay.requiredHours));
            save(String(scheduledSpecialDay.requiredHours));
          }}
          className="text-[10px] text-[var(--color-accent)] hover:text-cyan-200"
        >
          {scheduledSpecialDay.name} scheduled — use {scheduledSpecialDay.requiredHours}h
        </button>
      )}
    </div>
  );
}
