"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import {
  TimePicker,
  DEFAULT_TIME_PICKER_VALUE,
  nowTimePickerValue,
} from "@/components/ui/time-picker";
import { timePickerToDate } from "@/lib/time-local";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface ManualEntryProps {
  date: string;
  onSuccess: () => void;
}

export function ManualEntry({ date, onSuccess }: ManualEntryProps) {
  const [type, setType] = useState<"IN" | "OUT">("IN");
  const [time, setTime] = useState(DEFAULT_TIME_PICKER_VALUE);
  const [dayType, setDayType] = useState<"FULL" | "HALF_DAY_LEAVE" | "SPECIAL">("FULL");
  const [requiredHours, setRequiredHours] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTime(nowTimePickerValue());
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        date,
        type,
        dayType,
      };

      if (dayType === "SPECIAL" && requiredHours) {
        body.requiredHours = parseFloat(requiredHours);
      }

      body.timestamp = timePickerToDate(date, time).toISOString();

      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to add entry");
        return;
      }

      toast.success(`${type} punch added`);
      setTime(nowTimePickerValue());
      onSuccess();
    } catch {
      toast.error("Failed to add entry");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardTitle className="flex items-center gap-2 mb-4">
        <Plus className="w-5 h-5 text-[var(--color-primary)]" />
        Manual Entry
      </CardTitle>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Punch type</Label>
            <Select value={type} onChange={(e) => setType(e.target.value as "IN" | "OUT")}>
              <option value="IN">IN</option>
              <option value="OUT">OUT</option>
            </Select>
          </div>
          <div>
            <Label>Day type</Label>
            <Select
              value={dayType}
              onChange={(e) =>
                setDayType(e.target.value as "FULL" | "HALF_DAY_LEAVE" | "SPECIAL")
              }
            >
              <option value="FULL">Full day (8h)</option>
              <option value="HALF_DAY_LEAVE">Half day leave (4h)</option>
              <option value="SPECIAL">Special / custom hours</option>
            </Select>
          </div>
        </div>

        {dayType === "SPECIAL" && (
          <div>
            <Label>Required hours (e.g. 3 for Onam)</Label>
            <Input
              type="number"
              step="0.5"
              min="0.5"
              max="12"
              placeholder="3"
              value={requiredHours}
              onChange={(e) => setRequiredHours(e.target.value)}
              required
            />
          </div>
        )}

        <TimePicker value={time} onChange={setTime} />

        <p className="text-xs text-[var(--color-muted)]">
          Missing OUT is handled automatically — no need to add a clock-out punch unless you want to record an exact time.
        </p>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Adding..." : `Add ${type} punch`}
        </Button>
      </form>
    </Card>
  );
}
